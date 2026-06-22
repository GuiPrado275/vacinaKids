import { Injectable, inject } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signOut, deleteUser } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

import { Responsavel, ResponsavelForm, ResponsavelPerfil } from '../model/responsavel.model';
import { normalizarCpf, cpfParaEmailSintetico } from '../util/cpf.util';

const NOME_COLECAO = 'responsaveis';

@Injectable({ providedIn: 'root' })
export class ResponsavelService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  private readonly colecaoRef = collection(this.firestore, NOME_COLECAO);

  // Stream reativo de TODOS os responsáveis, usado na tela de
  // gerenciamento de usuários (admin).
  listar(): Observable<Responsavel[]> {
    return collectionData(this.colecaoRef, { idField: 'id' }) as Observable<Responsavel[]>;
  }

  // Versão Observable de buscarPorId, usada pelo AuthService pra manter o cache de sessão sincronizado com
  // Firestore em tempo real
  buscarPorIdObservable(id: string): Observable<Responsavel | undefined> {
    const ref = doc(this.firestore, NOME_COLECAO, id);
    return docData(ref, { idField: 'id' }) as Observable<Responsavel | undefined>;
  }

  // Versão Promise, pra fluxos pontuais (login, por exemplo) que só
  // precisam ler uma vez, sem ficar inscrito esperando atualizações.
  async buscarPorId(id: string): Promise<Responsavel | undefined> {
    const ref = doc(this.firestore, NOME_COLECAO, id);
    const snapshot = await getDoc(ref);
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Responsavel) : undefined;
  }

  // IMPORTANTE: essa busca só funciona pra ADMIN (regras do Firestore restringem listar/consultar toda a coleção
  // responsaveis a quem tem isAdmin == true
  async buscarPorCpf(cpf: string): Promise<Responsavel | undefined> {
    const cpfNormalizado = normalizarCpf(cpf);
    const consulta = query(this.colecaoRef, where('cpf', '==', cpfNormalizado));
    const snapshot = await getDocs(consulta);
    if (snapshot.empty) return undefined;
    const primeiro = snapshot.docs[0];
    return { id: primeiro.id, ...primeiro.data() } as Responsavel;
  }

  // Cadastra um novo responsável: cria a CONTA no Firebase Auth (e-mail sintético a partir do CPF + senha) e,
  // com o uid gerado, cria o documento de PERFIL correspondente no Firestore
  async cadastrar(dados: ResponsavelForm): Promise<Responsavel> {
    const cpfNormalizado = normalizarCpf(dados.cpf);

    if (cpfNormalizado.length !== 11) {
      throw new Error('CPF inválido. Informe os 11 dígitos.');
    }

    const email = cpfParaEmailSintetico(cpfNormalizado);

    let uid: string;
    try {
      const credencial = await createUserWithEmailAndPassword(this.auth, email, dados.senha);
      uid = credencial.user.uid;
    } catch (erro: any) {
      if (erro?.code === 'auth/email-already-in-use') {
        throw new Error('Já existe um responsável cadastrado com esse CPF.');
      }
      if (erro?.code === 'auth/weak-password') {
        throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      }
      throw erro instanceof Error ? erro : new Error('Não foi possível concluir o cadastro.');
    }

    const perfil: ResponsavelPerfil = {
      nome: dados.nome,
      cpf: cpfNormalizado,
      ...(dados.email ? { email: dados.email } : {}),
      ...(dados.telefone ? { telefone: dados.telefone } : {}),
    };

    const ref = doc(this.firestore, NOME_COLECAO, uid);
    try {
      await setDoc(ref, perfil);
    } catch (erro) {
      await deleteUser(this.auth.currentUser!);
      throw new Error('Não foi possível concluir o cadastro. Tente novamente.');
    }

    // Ver comentário no topo do método: de propósito não fica logado.
    await signOut(this.auth);

    return { id: uid, ...perfil };
  }

  // Atualiza só o documento de PERFIL (Firestore) — nome, e-mail. Troca de SENHA é responsabilidade do AuthService
  // (atualizarSenha), porque senha mora no Firebase Auth, não aqui.
  async atualizar(id: string, dados: Partial<Omit<ResponsavelPerfil, 'cpf'>>): Promise<void> {
    const ref = doc(this.firestore, NOME_COLECAO, id);
    await updateDoc(ref, { ...dados });
  }

  // Remove só o documento de PERFIL (Firestore). A CONTA (Firebase Auth) é removida separadamente
  async remover(id: string): Promise<void> {
    const responsavel = await this.buscarPorId(id);
    if (responsavel?.isAdmin) {
      throw new Error('A conta de administrador não pode ser removida.');
    }

    const ref = doc(this.firestore, NOME_COLECAO, id);
    await deleteDoc(ref);
  }
}
