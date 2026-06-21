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

// Cadastro dos responsáveis (pode existir vários, cada um é uma "conta"
// diferente). Esse service cuida do PERFIL (documento no Firestore,
// coleção `responsaveis`) — quem cuida da CREDENCIAL (e-mail sintético +
// senha) e da sessão ativa é o AuthService (Firebase Auth), de propósito
// separado daqui.
//
// MIGRAÇÃO PRA FIREBASE: cada documento dessa coleção tem como ID o
// mesmo "uid" da conta correspondente no Firebase Auth — é assim que os
// dois ficam ligados. Não existe mais "lista em memória + localStorage";
// cada leitura/escrita aqui é uma chamada real ao Firestore.
@Injectable({ providedIn: 'root' })
export class ResponsavelService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  private readonly colecaoRef = collection(this.firestore, NOME_COLECAO);

  // Stream reativo de TODOS os responsáveis — usado na tela de
  // gerenciamento de usuários (admin). As regras de segurança do
  // Firestore (ver firestore.rules) são quem realmente garante que só o
  // admin consegue ler a coleção inteira; aqui é só a query.
  listar(): Observable<Responsavel[]> {
    return collectionData(this.colecaoRef, { idField: 'id' }) as Observable<Responsavel[]>;
  }

  // Versão Observable de buscarPorId, usada pelo AuthService pra manter
  // o cache de sessão sincronizado com o Firestore em tempo real (ex.: se
  // o admin editar o perfil de alguém, ou os dados do próprio usuário
  // mudarem em outra aba, o cache local acompanha automaticamente).
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

  // IMPORTANTE: essa busca só funciona pra ADMIN (regras do Firestore
  // restringem listar/consultar toda a coleção responsaveis a quem tem
  // isAdmin == true — ver firestore.rules). Por isso não é usada mais
  // dentro de `cadastrar()` pra checar duplicidade: o próprio
  // createUserWithEmailAndPassword já rejeita CPF repetido naturalmente
  // (o e-mail sintético é derivado do CPF, então CPF duplicado = e-mail
  // duplicado pro Firebase Auth — ver tratamento de
  // 'auth/email-already-in-use' em `cadastrar`). Esse método continua
  // disponível só pra uso administrativo futuro, se precisar.
  async buscarPorCpf(cpf: string): Promise<Responsavel | undefined> {
    const cpfNormalizado = normalizarCpf(cpf);
    const consulta = query(this.colecaoRef, where('cpf', '==', cpfNormalizado));
    const snapshot = await getDocs(consulta);
    if (snapshot.empty) return undefined;
    const primeiro = snapshot.docs[0];
    return { id: primeiro.id, ...primeiro.data() } as Responsavel;
  }

  // Cadastra um novo responsável: cria a CONTA no Firebase Auth (e-mail
  // sintético a partir do CPF + senha) e, com o uid gerado, cria o
  // documento de PERFIL correspondente no Firestore — as duas coisas
  // precisam acontecer juntas, ou a conta fica "pela metade".
  //
  // Efeito colateral do Firebase: createUserWithEmailAndPassword loga
  // automaticamente a pessoa que acabou de se cadastrar nesse navegador.
  // Como o app quer mandar pra tela de LOGIN depois do cadastro (não
  // entrar direto, ver CadastroPage), deslogamos logo em seguida — a
  // pessoa precisa digitar a senha de novo, igual qualquer app real.
  //
  // IMPORTANTE: de propósito NÃO checa duplicidade de CPF chamando
  // buscarPorCpf antes — isso exigiria listar a coleção inteira, e as
  // regras de segurança só liberam isso pro admin (ver comentário acima).
  // A checagem de duplicidade acontece de forma natural: como o e-mail
  // sintético é derivado do CPF, CPF repetido vira e-mail repetido, e o
  // Firebase Auth rejeita com 'auth/email-already-in-use' (tratado no
  // catch abaixo) antes de qualquer escrita no Firestore.
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
        // Não deveria acontecer (já checamos buscarPorCpf acima), mas se
        // o Auth e o Firestore ficaram dessincronizados por algum motivo
        // anterior, essa mensagem é mais clara que o erro cru do Firebase.
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
      // Firestore não aceita `undefined` como valor de campo — por isso
      // email/telefone só entram no objeto quando têm valor real. Sem
      // isso, o setDoc abaixo lança erro sempre que o formulário não
      // preenche um desses campos opcionais (ex.: telefone, que o
      // formulário de cadastro nem coleta hoje).
      ...(dados.email ? { email: dados.email } : {}),
      ...(dados.telefone ? { telefone: dados.telefone } : {}),
    };

    const ref = doc(this.firestore, NOME_COLECAO, uid);
    try {
      await setDoc(ref, perfil);
    } catch (erro) {
      // Se o documento de perfil não puder ser criado (ex.: regra de
      // segurança recusou, ou a conexão caiu nesse meio tempo), a conta
      // no Firebase Auth ficaria "órfã" — criada, mas sem perfil, o que
      // impediria login pra sempre (ver AuthService.login, que falha sem
      // perfil). Como o SDK do navegador só pode excluir a PRÓPRIA conta
      // (e é exatamente quem está logado nesse momento, recém-criado),
      // desfazemos a criação aqui pra não deixar lixo no Authentication.
      await deleteUser(this.auth.currentUser!);
      throw new Error('Não foi possível concluir o cadastro. Tente novamente.');
    }

    // Ver comentário no topo do método: de propósito não fica logado.
    await signOut(this.auth);

    return { id: uid, ...perfil };
  }

  // Atualiza só o documento de PERFIL (Firestore) — nome, e-mail,
  // telefone. Troca de SENHA é responsabilidade do AuthService
  // (atualizarSenha), porque senha mora no Firebase Auth, não aqui.
  async atualizar(id: string, dados: Partial<Omit<ResponsavelPerfil, 'cpf'>>): Promise<void> {
    const ref = doc(this.firestore, NOME_COLECAO, id);
    await updateDoc(ref, { ...dados });
  }

  // Remove só o documento de PERFIL (Firestore). A CONTA (Firebase Auth)
  // é removida separadamente — ver AuthService.excluirConta, pra
  // auto-exclusão, e o comentário em GerenciamentoUsuariosPage sobre a
  // limitação de o admin não conseguir apagar a conta de outra pessoa no
  // Auth a partir do navegador (isso exige Admin SDK / Cloud Functions).
  //
  // Proteção extra: a conta admin nunca é removida por aqui, mesmo que
  // alguém tente chamar isso direto (ex.: bug de UI). A tela de "excluir
  // conta" já nem mostra a opção pro admin, mas a regra de negócio real
  // mora aqui, não só na UI. As regras de segurança do Firestore (ver
  // firestore.rules) reforçam essa mesma trava no lado do servidor.
  async remover(id: string): Promise<void> {
    const responsavel = await this.buscarPorId(id);
    if (responsavel?.isAdmin) {
      throw new Error('A conta de administrador não pode ser removida.');
    }

    const ref = doc(this.firestore, NOME_COLECAO, id);
    await deleteDoc(ref);
  }
}
