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

export interface SessaoResolvida {
  usuario: User | null;
  responsavel: Responsavel | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly responsavelService = inject(ResponsavelService);

  // Cache local do perfil (Firestore) do usuário autenticado agora.
  private readonly responsavelLogado$$ = new BehaviorSubject<Responsavel | null>(null);

  // Stream "oficial" do usuário do Firebase Auth (token JWT por trás).
  readonly usuarioAuth$: Observable<User | null> = authState(this.auth);

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
    this.sessao$.subscribe(({ responsavel }) => this.responsavelLogado$$.next(responsavel));
  }

  // null quando ninguém está logado, as telas/guards de rota decidem o
  // que fazer nesse caso (normalmente, redirecionar pro login).
  responsavelLogado(): Observable<Responsavel | null> {
    return this.responsavelLogado$$.asObservable();
  }

  estaLogado(): boolean {
    return this.auth.currentUser !== null;
  }

  // Usado pelas telas que precisam decidir se mostram algo só pro administrador
  ehAdmin(): boolean {
    return this.responsavelLogado$$.value?.isAdmin === true;
  }

  // Usado por outros services (CriancaService, por exemplo) pra saber de quem é a conta ativa
  obterIdResponsavelLogado(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }

  obterResponsavelLogado(): Responsavel | null {
    return this.responsavelLogado$$.value;
  }

  // Login de verdade: CPF vira e-mail sintético (ver cpf.util.ts) e a senha é conferida pelo próprio Firebase Auth
  // (nunca em texto puro no nosso código). Devolve o perfil em caso de sucesso, ou lança erro com mensagem amigável
  // em caso de falha a tela decide como mostrar.
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
      // Por segurança, não dizemos qual dos dois falhou (CPF inexistente OU senha errada), mesma postura que
      // já existia antes da migração, só que agora traduzindo os códigos de erro do Firebase.
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

  // Atualiza a senha da CREDENCIAL (Firebase Auth)
  async atualizarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
    const usuario = this.auth.currentUser;
    if (!usuario) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    await this.confirmarSenhaAtual(senhaAtual);
    await updateAuthPassword(usuario, novaSenha);
  }

  // Confere se a senha informada é de fato a senha atual da conta logada
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

  // Exclui só a CONTA (Firebase Auth)
  async excluirConta(): Promise<void> {
    const usuario = this.auth.currentUser;
    if (!usuario) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    await deleteUser(usuario);
  }
}
