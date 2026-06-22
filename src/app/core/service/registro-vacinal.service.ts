import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  getDoc,
  updateDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { Crianca } from '../model/crianca.model';
import { Vacina } from '../model/vacina.model';
import { RegistroVacinal, calcularDataPrevista, calcularStatusVacina } from '../model/registro-vacinal.model';
import { StatusVacina } from '../model/enum/status-vacina.enum';
import { VacinaService } from './vacina.service';
import { AuthService } from './auth.service';

const NOME_COLECAO = 'registrosVacinais';

export interface RegistroDetalhado extends RegistroVacinal {
  vacina: Vacina;
  status: StatusVacina;
}

// Contagem pronta pra exibir algo como "5 de 12 vacinas em dia", sem o
// componente precisar percorrer a lista toda de novo (Cenário 1 do desafio).
export interface ResumoVacinal {
  total: number;
  aplicadas: number;
  emDia: number;
  atrasadas: number;
  futuras: number;
}

// Aqui mora a regra de negócio principal do app: o calendário de vacinas
// de cada criança e o cálculo de quem está em dia, atrasado ou já vacinado.
@Injectable({ providedIn: 'root' })
export class RegistroVacinalService {
  private readonly firestore = inject(Firestore);
  private readonly vacinaService = inject(VacinaService);
  private readonly authService = inject(AuthService);

  private readonly colecaoRef = collection(this.firestore, NOME_COLECAO);

  // Cria um registro pra cada vacina do catálogo, já com a data prevista
  // calculada a partir do nascimento da criança
  async gerarCalendarioPara(crianca: Crianca): Promise<void> {
    const lote = writeBatch(this.firestore);

    this.vacinaService.listarSincrono().forEach((vacina) => {
      const novoRegistroRef = doc(this.colecaoRef);
      const registro: RegistroVacinal = {
        id: novoRegistroRef.id,
        criancaId: crianca.id,
        vacinaId: vacina.id,
        dataPrevista: calcularDataPrevista(crianca.dataNascimento, vacina.idadeRecomendadaMeses),
        dataAplicacao: null,
        responsavelId: crianca.responsavelId,
      };
      lote.set(novoRegistroRef, registro);
    });

    await lote.commit();
  }

  // Registros "crus" de uma criança, sem juntar com a vacina ainda.
  listarPorCrianca(criancaId: string): Observable<RegistroVacinal[]> {
    const idResponsavelLogado = this.authService.obterIdResponsavelLogado();
    if (!idResponsavelLogado) return of([]);

    const consulta = query(
      this.colecaoRef,
      where('criancaId', '==', criancaId),
      where('responsavelId', '==', idResponsavelLogado)
    );
    return collectionData(consulta, { idField: 'id' }) as Observable<RegistroVacinal[]>;
  }

  // Versão completa, já com nome/dados da vacina e status calculado, ordenada pela data prevista.
  // É essa que a tela da carteira de vacinação de uma criança específica deve usar.
  listarDetalhadoPorCrianca(criancaId: string): Observable<RegistroDetalhado[]> {
    return combineLatest([this.listarPorCrianca(criancaId), this.vacinaService.listar()]).pipe(
      map(([registros, vacinas]) => this.detalharLista(registros, vacinas))
    );
  }

  // Atende ao Cenário 1: resumo pronto pra exibir num card/indicador visual
  // (ex.: barra de progresso "8 de 12 vacinas aplicadas").
  obterResumo(criancaId: string): Observable<ResumoVacinal> {
    return this.listarDetalhadoPorCrianca(criancaId).pipe(
      map((registros) => ({
        total: registros.length,
        aplicadas: registros.filter((registro) => registro.status === StatusVacina.APLICADA).length,
        emDia: registros.filter((registro) => registro.status === StatusVacina.EM_DIA).length,
        atrasadas: registros.filter((registro) => registro.status === StatusVacina.ATRASADA).length,
        futuras: registros.filter((registro) => registro.status === StatusVacina.FUTURA).length,
      }))
    );
  }

  // Marca a vacina como efetivamente aplicada.
  async registrarAplicacao(registroId: string, dataAplicacao: string, localAplicacao?: string): Promise<void> {
    const ref = doc(this.firestore, NOME_COLECAO, registroId);
    const snapshot = await getDoc(ref);
    const registro = snapshot.exists() ? (snapshot.data() as RegistroVacinal) : undefined;

    if (registro && calcularStatusVacina(registro) === StatusVacina.FUTURA) {
      throw new Error('Essa vacina ainda não pode ser marcada como aplicada — está fora do período recomendado.');
    }

    await updateDoc(ref, { dataAplicacao, ...(localAplicacao ? { localAplicacao } : {}) });
  }

  // Caso o responsável marque por engano, desfaz e o status volta a ser
  // calculado normalmente a partir da data prevista.
  async desfazerAplicacao(registroId: string): Promise<void> {
    const ref = doc(this.firestore, NOME_COLECAO, registroId);
    await updateDoc(ref, { dataAplicacao: null, localAplicacao: null });
  }

  // Limpeza usada quando uma criança é removida do app, pra não deixar
  // registro órfão guardado sem necessidade.
  async removerPorCrianca(criancaId: string, responsavelId: string): Promise<void> {
    const consulta = query(
      this.colecaoRef,
      where('criancaId', '==', criancaId),
      where('responsavelId', '==', responsavelId)
    );
    const snapshot = await getDocs(consulta);

    if (snapshot.empty) return;

    const lote = writeBatch(this.firestore);
    snapshot.docs.forEach((documento) => lote.delete(documento.ref));
    await lote.commit();
  }

  // Junta cada registro com a vacina correspondente e calcula o status na hora (nunca fica salvo, senão "atrasada"
  // ficaria desatualizada com o tempo, mesma ideia já explicada no model RegistroVacinal).
  private detalharLista(registros: RegistroVacinal[], vacinas: Vacina[]): RegistroDetalhado[] {
    return registros
      .map((registro) => {
        const vacina = vacinas.find((v) => v.id === registro.vacinaId);
        return vacina ? { ...registro, vacina, status: calcularStatusVacina(registro) } : null;
      })
      .filter((registro): registro is RegistroDetalhado => registro !== null)
      .sort((a, b) => a.dataPrevista.localeCompare(b.dataPrevista));
  }
}
