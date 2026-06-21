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

// O responsavelId não deve vir do formulário de cadastro — é o próprio
// service que decide de quem é a criança, com base em quem está logado
// no momento (ver AuthService). Por isso o tipo de entrada do cadastrar()
// exclui esse campo, evitando que o componente precise (ou consiga)
// inventar um responsavelId.
export type DadosCadastroCrianca = Omit<CriancaForm, 'responsavelId'>;

// O cadastro de uma criança só pode ser feito por uma conta logada — é
// literalmente a regra de negócio pedida ("a criança pertence à conta do
// responsável"). Esse erro existe pra um componente que tentar cadastrar
// sem login feito (por bug, rota mal protegida etc.) falhar de forma
// clara, em vez de criar uma criança "fantasma" sem responsável de verdade.
export class NaoAutenticadoError extends Error {
  constructor() {
    super('É necessário estar logado para cadastrar uma criança.');
  }
}

// MIGRAÇÃO PRA FIREBASE: cada criança é um documento na coleção
// `criancas`, com um campo `responsavelId` apontando pro uid do
// responsável dono dela (Firebase Auth). As regras de segurança do
// Firestore (ver firestore.rules) garantem no lado do servidor que cada
// responsável só lê/escreve as próprias crianças — não é só uma
// filtragem "de fachada" na tela, é impossível burlar via DevTools.
@Injectable({ providedIn: 'root' })
export class CriancaService {
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);
  private readonly registroVacinalService = inject(RegistroVacinalService);

  private readonly colecaoRef = collection(this.firestore, NOME_COLECAO);

  // Lista reativa: além de reagir a mudanças nas próprias crianças (em
  // tempo real, via Firestore), reage também ao login/logout (switchMap
  // no responsável logado). Isso é o que faz a troca de conta ser
  // "funcional" de verdade — se a pessoa deslogar e outro responsável
  // logar, a lista atualiza sozinha. Sem ninguém logado, devolve uma
  // lista vazia (não é erro, simplesmente não há conta ativa pra mostrar
  // filhos) — e, crucial, SEM tentar consultar o Firestore nesse caso,
  // porque uma query sem usuário autenticado seria rejeitada pelas regras
  // de segurança (e cairia como erro, não como lista vazia).
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

  // Sem filtrar pelo responsável logado — usada na tela de gerenciamento
  // de usuários (admin), que precisa contar quantas crianças cada
  // responsável do sistema tem, não só as da própria conta. Só o admin
  // consegue de fato rodar essa consulta (regras do Firestore exigem
  // isAdmin == true pra ler crianças de outro responsavelId).
  async contarPorResponsavel(responsavelId: string): Promise<number> {
    const consulta = query(this.colecaoRef, where('responsavelId', '==', responsavelId));
    const snapshot = await getDocs(consulta);
    return snapshot.size;
  }

  // IMPORTANTE (regras de segurança): essa busca só consegue "enxergar"
  // crianças do responsável logado — as regras do Firestore bloqueiam
  // ler o documento de uma criança que não é sua (ver firestore.rules,
  // regra `get` de /criancas), então a checagem de duplicidade abaixo só
  // vale DENTRO de uma mesma conta. Duas contas diferentes podem
  // cadastrar uma criança com o mesmo CPF sem o sistema detectar — é uma
  // escolha consciente: a alternativa exigiria expor dados de crianças
  // de outras contas pra qualquer pessoa logada (ruim) ou uma Cloud
  // Function paga só pra essa checagem (fora do escopo agora).
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

  // Cadastra a criança na conta de quem está logado agora, valida o CPF
  // dela (mesma regra usada no Responsavel) e, na sequência, já gera o
  // calendário de vacinas completo. Essa ligação é a regra de negócio
  // mais importante do desafio: o responsável não precisa montar esse
  // calendário manualmente, ele já nasce pronto a partir da data de
  // nascimento informada.
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

  // Remove a criança e, junto, todo o histórico vacinal dela — evita ficar
  // registro perdido sem nenhuma criança associada.
  //
  // Recebe responsavelId explicitamente em vez de buscar a criança pra
  // descobrir de quem ela é — quem chama esse método já sabe (ver
  // removerPorResponsavel logo abaixo, e EditarUsuarioPage/
  // GerenciamentoUsuariosPage). Isso também evita uma consulta extra e
  // dispensa qualquer cuidado especial com ORDEM de remoção: como
  // RegistroVacinalService.removerPorCrianca não depende mais de
  // consultar o documento da criança (usa responsavelId desnormalizado
  // nos próprios registros — ver model RegistroVacinal), criança e
  // registros podem ser removidos em qualquer ordem.
  async remover(id: string, responsavelId: string): Promise<void> {
    await this.registroVacinalService.removerPorCrianca(id, responsavelId);
    const ref = doc(this.firestore, NOME_COLECAO, id);
    await deleteDoc(ref);
  }

  // Remove TODAS as crianças de um responsável de uma vez (e os
  // respectivos registros vacinais, via remover() de cada uma). Usado
  // quando a própria conta é excluída (EditarUsuarioPage) ou quando o
  // admin remove um usuário pela tela de gerenciamento — centralizado
  // aqui em vez de cada tela reimplementar esse "busca e remove uma por
  // uma", já que as duas situações precisam do mesmo comportamento.
  async removerPorResponsavel(responsavelId: string): Promise<void> {
    const consulta = query(this.colecaoRef, where('responsavelId', '==', responsavelId));
    const snapshot = await getDocs(consulta);
    await Promise.all(snapshot.docs.map((documento) => this.remover(documento.id, responsavelId)));
  }
}
