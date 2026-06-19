import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { Responsavel, ResponsavelForm } from '../model/responsavel.model';
import { StorageService } from './storage.service';
import { normalizarCpf, validarCpf } from '../util/cpf.util';

const CHAVE_STORAGE = 'vacina_app_responsaveis';

// Cadastro dos responsáveis (pode existir vários, cada um é uma "conta"
// diferente). Esse service cuida só dos dados (CRUD) — quem decide "quem
// está logado agora" é o AuthService, de propósito separado daqui, pra
// não misturar cadastro com sessão.
@Injectable({ providedIn: 'root' })
export class ResponsavelService {
  private readonly responsaveis$$: BehaviorSubject<Responsavel[]>;

  constructor(private storage: StorageService) {
    this.responsaveis$$ = new BehaviorSubject<Responsavel[]>(
      this.storage.obter<Responsavel[]>(CHAVE_STORAGE) ?? this.responsaveisIniciais()
    );
  }

  // Um responsável de exemplo já cadastrado, pra dar pra testar o login
  // (e ver as crianças de exemplo) sem precisar criar uma conta antes.
  // CPF e senha de teste: 123.456.789-09 / 123456 (vale colocar isso no
  // README de entrega do desafio).
  private responsaveisIniciais(): Responsavel[] {
    return [
      {
        id: 'resp-1',
        nome: 'Responsável Demo',
        cpf: '12345678909',
        senha: '123456',
        email: 'demo@email.com',
      },
    ];
  }

  listar(): Observable<Responsavel[]> {
    return this.responsaveis$$.asObservable();
  }

  buscarPorId(id: string): Responsavel | undefined {
    return this.responsaveis$$.value.find((responsavel) => responsavel.id === id);
  }

  // O CPF é normalizado (só números) antes de comparar, assim não importa
  // se quem está chamando digitou com ponto/traço ou não.
  buscarPorCpf(cpf: string): Responsavel | undefined {
    const cpfNormalizado = normalizarCpf(cpf);
    return this.responsaveis$$.value.find((responsavel) => responsavel.cpf === cpfNormalizado);
  }

  // Cadastra um novo responsável. Valida o CPF (formato + dígitos
  // verificadores) e garante que não existem dois responsáveis com o
  // mesmo CPF, já que é o CPF que identifica a conta no login.
  cadastrar(dados: ResponsavelForm): Responsavel {
    const cpfNormalizado = normalizarCpf(dados.cpf);

    if (!validarCpf(cpfNormalizado)) {
      throw new Error('CPF inválido.');
    }

    if (this.buscarPorCpf(cpfNormalizado)) {
      throw new Error('Já existe um responsável cadastrado com esse CPF.');
    }

    const novoResponsavel: Responsavel = {
      ...dados,
      cpf: cpfNormalizado,
      id: crypto.randomUUID(),
    };

    this.responsaveis$$.next([...this.responsaveis$$.value, novoResponsavel]);
    this.persistir();

    return novoResponsavel;
  }

  atualizar(id: string, dados: Partial<ResponsavelForm>): void {
    const lista = this.responsaveis$$.value.map((responsavel) =>
      responsavel.id === id
        ? { ...responsavel, ...dados, cpf: dados.cpf ? normalizarCpf(dados.cpf) : responsavel.cpf }
        : responsavel
    );
    this.responsaveis$$.next(lista);
    this.persistir();
  }

  // Remoção simples do responsável - de propósito, esse método não apaga
  // as crianças dele. Se o ResponsavelService dependesse do CriancaService
  // pra fazer essa limpeza, e o CriancaService precisa saber quem está
  // logado (depende do AuthService, que por sua vez depende deste
  // service), criaríamos uma dependência circular entre os services.
  // Por isso, excluir a conta E as crianças junto é orquestrado por quem
  // chama os dois services (uma tela de "excluir conta", por exemplo),
  // não por um service chamando o outro.
  remover(id: string): void {
    this.responsaveis$$.next(this.responsaveis$$.value.filter((responsavel) => responsavel.id !== id));
    this.persistir();
  }

  private persistir(): void {
    this.storage.salvar(CHAVE_STORAGE, this.responsaveis$$.value);
  }
}
