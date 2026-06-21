import { Injectable, inject } from '@angular/core';
import {
  Auth,
  authState,
  signInWithEmailAndPassword,
  signOut,
  updatePassword as updateAuthPassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  User,
} from '@angular/fire/auth';
import { Observable, BehaviorSubject, of, switchMap, shareReplay } from 'rxjs';

import { Responsavel } from '../model/responsavel.model';
import { ResponsavelService } from './responsavel.service';
import { cpfParaEmailSintetico } from '../util/cpf.util';

// O par (usuário do Firebase Auth, perfil correspondente no Firestore —
// ou null se não houver usuário logado) já resolvido e sincronizado. É o
// formato que os guards de rota usam pra nunca decidir com informação
// pela metade (ver authGuard/adminGuard).
export interface SessaoResolvida {
  usuario: User | null;
  responsavel: Responsavel | null;
}

// Cuida só de "quem está logado agora" — login, logout, e manter a sessão
// entre recarregamentos de página. Separado do ResponsavelService de
// propósito: um cuida do PERFIL (nome, e-mail, isAdmin — documento no
// Firestore), o outro cuida da CREDENCIAL e da SESSÃO (Firebase Auth).
//
// MIGRAÇÃO PRA FIREBASE: antes, a sessão era um id de responsável salvo
// "na mão" em localStorage — qualquer aba/navegador que lesse aquela
// chave entrava logado, mesmo sem ter passado pelo login (foi o bug
// relatado: colar um link em outra aba abria como se estivesse logado).
// Agora quem cuida da sessão é o Firebase Auth de verdade: ele guarda um
// token (gerenciado pelo SDK, com expiração real) e o valida a cada
// operação contra o Firestore via regras de segurança (ver
// firestore.rules) — copiar uma URL pra outro navegador/dispositivo sem
// ter feito login lá não dá mais acesso a nada.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly responsavelService = inject(ResponsavelService);

  // Cache local do perfil (Firestore) do usuário autenticado agora. Existe
  // por dois motivos: (1) telas como EditarUsuarioPage precisam dos dados
  // completos de forma síncrona às vezes; (2) evita que toda tela que só
  // quer "estou logado? sou admin?" precise esperar uma consulta ao
  // Firestore — o perfil já fica pronto assim que authState muda.
  private readonly responsavelLogado$$ = new BehaviorSubject<Responsavel | null>(null);

  // Stream "oficial" do usuário do Firebase Auth (token JWT por trás).
  readonly usuarioAuth$: Observable<User | null> = authState(this.auth);

  // Par (usuário, perfil) já SINCRONIZADO — cada emissão garante que o
  // `responsavel` já corresponde ao `usuario` daquele mesmo instante
  // (nunca um perfil "atrasado" de um login anterior, nem um usuário sem
  // perfil ainda buscado). switchMap troca de stream completamente toda
  // vez que o usuário muda, então não há como misturar dado de sessões
  // diferentes. shareReplay(1) garante que guards/telas que assinarem
  // depois recebam o último valor na hora, sem refazer a consulta.
  //
  // É ESSE Observable que authGuard/adminGuard devem usar — resolve o
  // problema de "flash" (decidir antes da hora) sem precisar de gambiarra
  // de timing em cada guard.
  readonly sessao$: Observable<SessaoResolvida> = this.usuarioAuth$.pipe(
    switchMap((usuario) => {
      if (!usuario) {
        return of<SessaoResolvida>({ usuario: null, responsavel: null });
      }
      return this.responsavelService
        .buscarPorIdObservable(usuario.uid)
        .pipe(switchMap((responsavel) => of<SessaoResolvida>({ usuario, responsavel: responsavel ?? null })));
    }),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  constructor() {
    // Mantém o cache síncrono (responsavelLogado$$) sempre alinhado com
    // o sessao$ acima — é o que dá suporte aos métodos síncronos
    // (ehAdmin, obterResponsavelLogado) usados pelas telas.
    this.sessao$.subscribe(({ responsavel }) => this.responsavelLogado$$.next(responsavel));
  }

  // null quando ninguém está logado — as telas/guards de rota decidem o
  // que fazer nesse caso (normalmente, redirecionar pro login).
  responsavelLogado(): Observable<Responsavel | null> {
    return this.responsavelLogado$$.asObservable();
  }

  // Síncrono, baseado no token atual do Firebase Auth. Use com cuidado em
  // guards de rota (prefira sessao$, que espera o estado ser resolvido) —
  // este método é mais adequado pra checagens pontuais dentro de um
  // service já em execução (ex.: CriancaService.obterIdResponsavelLogado).
  estaLogado(): boolean {
    return this.auth.currentUser !== null;
  }

  // Usado pelas telas que precisam decidir se mostram algo só pro
  // administrador (ícone de criar campanha, link de gerenciar usuários
  // etc.), depois que a sessão já foi resolvida pelo guard da rota.
  // Centralizado aqui em vez de cada tela checar `responsavel?.isAdmin`
  // na mão, pra não espalhar esse `?? false` por todo canto.
  ehAdmin(): boolean {
    return this.responsavelLogado$$.value?.isAdmin === true;
  }

  // Usado por outros services (CriancaService, por exemplo) pra saber de
  // quem é a conta ativa, sem precisar virar Observable só pra pegar um id.
  // Vem direto do Firebase Auth (uid), não do cache de perfil — assim
  // funciona mesmo no instante entre o login completar e o perfil do
  // Firestore ainda não ter chegado.
  obterIdResponsavelLogado(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }

  // Versão síncrona do perfil completo (cache), pra telas que precisam
  // pré-preencher um formulário de uma vez, sem se inscrever num
  // Observable só pra isso.
  obterResponsavelLogado(): Responsavel | null {
    return this.responsavelLogado$$.value;
  }

  // Login de verdade: CPF vira e-mail sintético (ver cpf.util.ts) e a
  // senha é conferida pelo próprio Firebase Auth (nunca em texto puro no
  // nosso código). Devolve o perfil em caso de sucesso, ou lança erro com
  // mensagem amigável em caso de falha — a tela decide como mostrar.
  async login(cpf: string, senha: string): Promise<Responsavel> {
    const email = cpfParaEmailSintetico(cpf);

    try {
      const credencial = await signInWithEmailAndPassword(this.auth, email, senha);
      const perfil = await this.responsavelService.buscarPorId(credencial.user.uid);

      if (!perfil) {
        // Não deveria acontecer (todo cadastro cria os dois juntos — ver
        // ResponsavelService.cadastrar), mas se acontecer, não deixamos a
        // pessoa "meio logada" sem perfil nenhum.
        await signOut(this.auth);
        throw new Error('Não foi possível carregar os dados dessa conta. Tente novamente.');
      }

      return perfil;
    } catch (erro: any) {
      // Por segurança, não dizemos qual dos dois falhou (CPF inexistente
      // OU senha errada) — mesma postura que já existia antes da
      // migração, só que agora traduzindo os códigos de erro do Firebase.
      if (
        erro?.code === 'auth/invalid-credential' ||
        erro?.code === 'auth/user-not-found' ||
        erro?.code === 'auth/wrong-password'
      ) {
        throw new Error('CPF ou senha inválidos.');
      }
      if (erro?.code === 'auth/too-many-requests') {
        throw new Error('Muitas tentativas seguidas. Aguarde um pouco antes de tentar de novo.');
      }
      throw erro instanceof Error ? erro : new Error('Não foi possível entrar. Tente novamente.');
    }
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  // Atualiza a senha da CREDENCIAL (Firebase Auth) — diferente de
  // ResponsavelService.atualizar, que mexe no documento de PERFIL
  // (Firestore, e-mail "de contato"). EditarUsuarioPage chama os dois
  // quando a pessoa troca a senha.
  //
  // O Firebase Auth exige reautenticação recente pra esse tipo de
  // operação sensível — por isso pedimos a senha atual aqui (ver
  // confirmarSenhaAtual). Sem isso, o Firebase rejeita com
  // 'auth/requires-recent-login'.
  async atualizarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
    const usuario = this.auth.currentUser;
    if (!usuario) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    await this.confirmarSenhaAtual(senhaAtual);
    await updateAuthPassword(usuario, novaSenha);
  }

  // Confere se a senha informada é de fato a senha atual da conta logada
  // — usado como passo isolado ANTES de operações destrutivas (excluir
  // conta) que mexem em mais de um lugar (Firestore + Auth). Separado de
  // excluirConta de propósito: assim quem chama pode validar a senha
  // PRIMEIRO, só apagar dados do Firestore se a senha estiver certa, e só
  // então excluir a conta em si — em vez de excluir a conta e descobrir
  // só depois (com os dados já apagados) que a senha estava errada.
  async confirmarSenhaAtual(senhaAtual: string): Promise<void> {
    const usuario = this.auth.currentUser;
    if (!usuario || !usuario.email) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    try {
      const credencial = EmailAuthProvider.credential(usuario.email, senhaAtual);
      await reauthenticateWithCredential(usuario, credencial);
    } catch {
      throw new Error('Senha atual incorreta.');
    }
  }

  // Exclui só a CONTA (Firebase Auth) em si — chama isso por último,
  // depois de confirmarSenhaAtual e de já ter apagado o perfil/dados no
  // Firestore (ver EditarUsuarioPage.confirmarExclusao), porque depois de
  // deleteUser() a pessoa não está mais autenticada e não conseguiria
  // mais escrever no Firestore pra limpar os próprios dados.
  async excluirConta(): Promise<void> {
    const usuario = this.auth.currentUser;
    if (!usuario) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    await deleteUser(usuario);
  }
}
