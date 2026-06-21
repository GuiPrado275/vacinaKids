import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { Responsavel } from '../model/responsavel.model';
import { StorageService } from './storage.service';
import ResponsavelService from './responsavel.service';
import { normalizarCpf } from '../util/cpf.util';

const CHAVE_SESSAO = 'vacina_app_sessao';

// Cuida só de "quem está logado agora" — login, logout, e manter a sessão
// entre recarregamentos de página. Separado do ResponsavelService de
// propósito: um cuida do cadastro (dados de todos os responsáveis), o
// outro cuida da sessão (qual deles está usando o app agora). Se um login
// real (Firebase Auth, por exemplo) entrar no projeto depois, é só essa
// classe que precisa mudar.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly responsavelLogado$$: BehaviorSubject<Responsavel | null>;

  constructor(
    private storage: StorageService,
    private responsavelService: ResponsavelService
  ) {
    // Se já tinha uma sessão salva (o app foi recarregado, por exemplo),
    // tenta recuperar o responsável correspondente. Se o id salvo não
    // existir mais (conta removida), simplesmente não loga ninguém.
    const idSessao = this.storage.obter<string>(CHAVE_SESSAO);
    const responsavelDaSessao = idSessao ? this.responsavelService.buscarPorId(idSessao) ?? null : null;
    this.responsavelLogado$$ = new BehaviorSubject<Responsavel | null>(responsavelDaSessao);
  }

  // null quando ninguém está logado — as telas/guards de rota decidem o
  // que fazer nesse caso (normalmente, redirecionar pro login).
  responsavelLogado(): Observable<Responsavel | null> {
    return this.responsavelLogado$$.asObservable();
  }

  estaLogado(): boolean {
    return this.responsavelLogado$$.value !== null;
  }

  // Usado pelas telas/guards que precisam decidir se mostram algo só pro
  // administrador (ícone de criar campanha, link de gerenciar usuários
  // etc.). Centralizado aqui em vez de cada tela checar
  // `responsavel?.isAdmin` na mão, pra não espalhar esse `?? false` por
  // todo canto.
  ehAdmin(): boolean {
    return this.responsavelLogado$$.value?.isAdmin === true;
  }

  // Usado por outros services (CriancaService, por exemplo) pra saber de
  // quem é a conta ativa, sem precisar virar Observable só pra pegar um id.
  obterIdResponsavelLogado(): string | null {
    return this.responsavelLogado$$.value?.id ?? null;
  }

  // Versão síncrona de responsavelLogado(), pra telas que precisam dos
  // dados completos da conta ativa de uma vez (ex.: pré-preencher um
  // formulário de edição), sem se inscrever num Observable só pra isso.
  obterResponsavelLogado(): Responsavel | null {
    return this.responsavelLogado$$.value;
  }

  // Confere CPF + senha contra os responsáveis já cadastrados. Devolve o
  // responsável em caso de sucesso, ou null se não bater (a tela decide a
  // mensagem de erro, esse service só diz se deu certo ou não).
  //
  // Importante: aqui a senha é comparada em texto puro, porque o app não
  // tem backend — tudo fica salvo só no dispositivo da própria pessoa.
  // Em um app real isso nunca deveria ficar assim; seria responsabilidade
  // de um servidor (ou do Firebase Auth, um dos diferenciais do desafio)
  // verificar a senha de forma segura.
  login(cpf: string, senha: string): Responsavel | null {
    const responsavel = this.responsavelService.buscarPorCpf(normalizarCpf(cpf));

    if (!responsavel || responsavel.senha !== senha) {
      return null;
    }

    this.responsavelLogado$$.next(responsavel);
    this.storage.salvar(CHAVE_SESSAO, responsavel.id);

    return responsavel;
  }

  logout(): void {
    this.responsavelLogado$$.next(null);
    this.storage.remover(CHAVE_SESSAO);
  }

  // Atualiza o responsável da sessão ativa com os dados mais recentes do
  // ResponsavelService — usado depois de editar e-mail/senha em "Minha
  // conta" (EditarUsuarioPage), pra sessão em memória não ficar com dado
  // velho até a próxima vez que o app for recarregado.
  atualizarSessaoComDadosAtuais(): void {
    const idAtual = this.responsavelLogado$$.value?.id;
    if (!idAtual) return;

    const responsavelAtualizado = this.responsavelService.buscarPorId(idAtual);
    if (responsavelAtualizado) {
      this.responsavelLogado$$.next(responsavelAtualizado);
    }
  }
}
