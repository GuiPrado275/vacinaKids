import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { Crianca, CriancaForm } from '../model/crianca.model';
import { AuthService } from './auth.service';
import { RegistroVacinalService } from './registro-vacinal.service';
import { normalizarCpf } from '../util/cpf.util';

const NOME_COLECAO = 'criancas';

// O responsavelId não deve vir do formulário de cadastro
export type DadosCadastroCrianca = Omit<CriancaForm, 'responsavelId'>;

// O cadastro de uma criança só pode ser feito por uma conta logada, é
// literalmente a regra de negócio pedida ("a criança pertence à conta do
// responsável").
export class NaoAutenticadoError extends Error {
  constructor() {
    super('É necessário estar logado para cadastrar uma criança.');
  }
}

@Injectable({ providedIn: 'root' })
export class CriancaService {
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);
  private readonly registroVacinalService = inject(RegistroVacinalService);

  private readonly colecaoRef = collection(this.firestore, NOME_COLECAO);

  listar(): Observable<Crianca[]> {
    return this.authService.responsavelLogado().pipe(
      switchMap((responsavel) => {
        if (!responsavel) return of([]);
        const consulta = query(this.colecaoRef, where('responsavelId', '==', responsavel.id));
        return collectionData(consulta, { idField: 'id' }) as Observable<Crianca[]>;
      })
    );
  }

  buscarPorIdObservable(id: string): Observable<Crianca | undefined> {
    const ref = doc(this.firestore, NOME_COLECAO, id);
    return docData(ref, { idField: 'id' }) as Observable<Crianca | undefined>;
  }

  async buscarPorId(id: string): Promise<Crianca | undefined> {
    const ref = doc(this.firestore, NOME_COLECAO, id);
    const snapshot = await getDoc(ref);
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Crianca) : undefined;
  }

  //Só o admin onsegue de fato rodar essa consulta (regras do Firestore exigem isAdmin == true pra ler
  // crianças de outro responsavelId).
  async contarPorResponsavel(responsavelId: string): Promise<number> {
    const consulta = query(this.colecaoRef, where('responsavelId', '==', responsavelId));
    const snapshot = await getDocs(consulta);
    return snapshot.size;
  }

  async buscarPorCpf(cpf: string): Promise<Crianca | undefined> {
    const idResponsavelLogado = this.authService.obterIdResponsavelLogado();
    if (!idResponsavelLogado) return undefined;

    const cpfNormalizado = normalizarCpf(cpf);
    const consulta = query(
      this.colecaoRef,
      where('responsavelId', '==', idResponsavelLogado),
      where('cpf', '==', cpfNormalizado)
    );
    const snapshot = await getDocs(consulta);
    if (snapshot.empty) return undefined;
    const primeiro = snapshot.docs[0];
    return { id: primeiro.id, ...primeiro.data() } as Crianca;
  }

  // Cadastra a criança na conta de quem está logado agora, valida o CPF dela (mesma regra usada no Responsavel) e
  // na sequência, já gera o calendário de vacinas completo. Essa ligação é a regra de
  // negócio mais importante do desafio: o responsável não precisa montar esse calendário manualmente, ele já nasce
  // pronto a partir da data de nascimento informada.
  async cadastrar(dados: DadosCadastroCrianca): Promise<Crianca> {
    const idResponsavelLogado = this.authService.obterIdResponsavelLogado();
    if (!idResponsavelLogado) {
      throw new NaoAutenticadoError();
    }

    const cpfNormalizado = normalizarCpf(dados.cpf);

    if (cpfNormalizado.length !== 11) {
      throw new Error('CPF inválido. Informe os 11 dígitos.');
    }

    if (await this.buscarPorCpf(cpfNormalizado)) {
      throw new Error('Você já tem uma criança cadastrada com esse CPF.');
    }

    const novaCriancaSemId: CriancaForm = {
      ...dados,
      cpf: cpfNormalizado,
      responsavelId: idResponsavelLogado,
    };

    const refCriada = await addDoc(this.colecaoRef, novaCriancaSemId);
    const novaCrianca: Crianca = { id: refCriada.id, ...novaCriancaSemId };

    await this.registroVacinalService.gerarCalendarioPara(novaCrianca);

    return novaCrianca;
  }

  async atualizar(id: string, dados: Partial<CriancaForm>): Promise<void> {
    const ref = doc(this.firestore, NOME_COLECAO, id);
    await updateDoc(ref, {
      ...dados,
      ...(dados.cpf ? { cpf: normalizarCpf(dados.cpf) } : {}),
    });
  }

  // Remove a criança e, junto, todo o histórico vacinal dela, evita ficar
  async remover(id: string, responsavelId: string): Promise<void> {
    await this.registroVacinalService.removerPorCrianca(id, responsavelId);
    const ref = doc(this.firestore, NOME_COLECAO, id);
    await deleteDoc(ref);
  }

  // Remove TODAS as crianças de um responsável de uma vez
  async removerPorResponsavel(responsavelId: string): Promise<void> {
    const consulta = query(this.colecaoRef, where('responsavelId', '==', responsavelId));
    const snapshot = await getDocs(consulta);
    await Promise.all(snapshot.docs.map((documento) => this.remover(documento.id, responsavelId)));
  }
}
