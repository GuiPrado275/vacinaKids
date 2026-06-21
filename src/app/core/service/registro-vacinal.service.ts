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

// Junta o registro "puro" (model) com os dados da vacina e o status já
// calculado. É o formato que as telas realmente vão usar — assim o
// componente não precisa cruzar informação de três lugares diferentes
// só pra mostrar uma linha na carteira de vacinação.
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
//
// MIGRAÇÃO PRA FIREBASE: cada registro é um documento na coleção
// `registrosVacinais`, com campos `criancaId` E `responsavelId` (esse
// último desnormalizado a partir da criança — ver comentário no model
// RegistroVacinal). As regras de segurança (ver firestore.rules) exigem
// que toda query nessa coleção já venha filtrada por
// responsavelId == uid de quem está pedindo (ou seja admin) — por isso
// os métodos abaixo SEMPRE incluem esse filtro, nunca consultam só por
// criancaId sozinho.
@Injectable({ providedIn: 'root' })
export class RegistroVacinalService {
  private readonly firestore = inject(Firestore);
  private readonly vacinaService = inject(VacinaService);
  private readonly authService = inject(AuthService);

  private readonly colecaoRef = collection(this.firestore, NOME_COLECAO);

  // Cria um registro pra cada vacina do catálogo, já com a data prevista
  // calculada a partir do nascimento da criança (usa calcularDataPrevista,
  // que já existe no model). É chamado uma única vez, no momento em que a
  // criança é cadastrada (ver CriancaService) — não precisa ser chamado
  // de novo depois.
  //
  // Usa writeBatch em vez de várias chamadas addDoc soltas: grava as ~22
  // vacinas do catálogo numa única operação atômica (tudo cria com
  // sucesso, ou nada é criado) — mais rápido e evita ficar um calendário
  // "pela metade" se a conexão cair no meio do processo.
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
        // Desnormalizado a partir da criança — ver comentário no model
        // RegistroVacinal sobre por que isso existe (regras de segurança
        // do Firestore pra listas).
        responsavelId: crianca.responsavelId,
      };
      lote.set(novoRegistroRef, registro);
    });

    await lote.commit();
  }

  // Registros "crus" de uma criança, sem juntar com a vacina ainda.
  //
  // IMPORTANTE: o filtro extra por responsavelId não é só uma otimização
  // — é exigido pela regra de segurança `allow list` (ver
  // firestore.rules). Sem ele, a query falharia com permission denied
  // pra quem não é admin, mesmo sendo o dono da criança.
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

  // Versão completa, já com nome/dados da vacina e status calculado,
  // ordenada pela data prevista. É essa que a tela da carteira de
  // vacinação de uma criança específica deve usar.
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

  // Marca a vacina como efetivamente aplicada. A partir daqui o status
  // passa a ser sempre APLICADA, sem depender mais de data (ver
  // calcularStatusVacina no model).
  //
  // Regra de negócio: uma vacina FUTURA (data prevista a mais de um mês)
  // não pode ser marcada como aplicada — não faz sentido tomar uma vacina
  // fora de hora. Só vacinas EM_DIA (perto do prazo) ou ATRASADA podem.
  // Essa checagem fica aqui (não só na tela) porque é a regra de negócio
  // de verdade, e esse service é o único lugar que deveria gravar
  // dataAplicacao.
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
  // registro órfão guardado sem necessidade. Também usa writeBatch pelo
  // mesmo motivo do gerarCalendarioPara: uma criança pode ter ~22
  // registros, e queremos apagar todos de uma vez, atomicamente.
  //
  // Recebe responsavelId explicitamente (em vez de usar quem está
  // logado) porque esse método é chamado tanto pelo DONO da criança
  // (excluindo a própria conta) quanto pelo ADMIN (removendo crianças de
  // outro usuário, via CriancaService.removerPorResponsavel) — nesse
  // segundo caso, o uid de quem está logado (o admin) é diferente do
  // responsavelId gravado nos registros, e a query abaixo precisa do
  // valor CERTO pra bater com a regra de segurança (ver firestore.rules).
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

  // Junta cada registro com a vacina correspondente e calcula o status na
  // hora (nunca fica salvo, senão "atrasada" ficaria desatualizada com o
  // tempo — mesma ideia já explicada no model RegistroVacinal).
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
