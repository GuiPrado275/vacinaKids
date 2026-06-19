import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

import { Crianca, CriancaForm } from '../model/crianca.model';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';
import { RegistroVacinalService } from './registro-vacinal.service';
import { normalizarCpf, validarCpf } from '../util/cpf.util';

const CHAVE_STORAGE = 'vacina_app_criancas';

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

@Injectable({ providedIn: 'root' })
export class CriancaService {
  // Nada aqui usa "this.storage" ou qualquer service injetado direto no
  // inicializador do campo — é montado dentro do construtor, onde já está
  // garantido que os parâmetros injetados existem (ver StorageService
  // pra mais detalhes sobre por que isso importa).
  private readonly criancas$$: BehaviorSubject<Crianca[]>;

  constructor(
    private storage: StorageService,
    private authService: AuthService,
    private registroVacinalService: RegistroVacinalService
  ) {
    const dadosSalvos = this.storage.obter<Crianca[]>(CHAVE_STORAGE);
    this.criancas$$ = new BehaviorSubject<Crianca[]>(dadosSalvos ?? this.criancasIniciais());

    // Primeira vez que o app abre (nada salvo ainda no storage): já
    // geramos o calendário de vacinas das crianças de exemplo, pra não
    // abrir as telas vazias durante a avaliação do desafio.
    if (!dadosSalvos) {
      this.criancas$$.value.forEach((crianca) => this.registroVacinalService.gerarCalendarioPara(crianca));
      this.persistir();
    }
  }

  // Duas crianças de exemplo, já ligadas ao responsável demo criado em
  // ResponsavelService ('resp-1'). Idades bem diferentes ajudam a deixar
  // visível o Cenário 4 do desafio (família com mais de um filho, cada um
  // com sua própria situação vacinal) sem precisar cadastrar nada na mão.
  private criancasIniciais(): Crianca[] {
    return [
      { id: 'crianca-1', nome: 'Alice', cpf: '98765432100', dataNascimento: '2025-03-10', responsavelId: 'resp-1', sexo: 'F' },
      { id: 'crianca-2', nome: 'Theo', cpf: '11122233396', dataNascimento: '2022-11-22', responsavelId: 'resp-1', sexo: 'M' },
    ];
  }

  // Lista reativa: além de reagir a mudanças nas próprias crianças, reage
  // também ao login/logout (combineLatest com o responsável logado). Isso
  // é o que faz a troca de conta ser "funcional" de verdade — se a pessoa
  // deslogar e outro responsável logar, a lista atualiza sozinha, sem
  // precisar recarregar a página. Sem ninguém logado, devolve uma lista
  // vazia (não é erro, simplesmente não há conta ativa pra mostrar filhos).
  listar(): Observable<Crianca[]> {
    return combineLatest([this.criancas$$.asObservable(), this.authService.responsavelLogado()]).pipe(
      map(([criancas, responsavel]) =>
        responsavel ? criancas.filter((crianca) => crianca.responsavelId === responsavel.id) : []
      )
    );
  }

  buscarPorId(id: string): Crianca | undefined {
    return this.criancas$$.value.find((crianca) => crianca.id === id);
  }

  buscarPorCpf(cpf: string): Crianca | undefined {
    const cpfNormalizado = normalizarCpf(cpf);
    return this.criancas$$.value.find((crianca) => crianca.cpf === cpfNormalizado);
  }

  // Cadastra a criança na conta de quem está logado agora, valida o CPF
  // dela (mesma regra usada no Responsavel) e, na sequência, já gera o
  // calendário de vacinas completo. Essa ligação é a regra de negócio
  // mais importante do desafio: o responsável não precisa montar esse
  // calendário manualmente, ele já nasce pronto a partir da data de
  // nascimento informada.
  cadastrar(dados: DadosCadastroCrianca): Crianca {
    const idResponsavelLogado = this.authService.obterIdResponsavelLogado();
    if (!idResponsavelLogado) {
      throw new NaoAutenticadoError();
    }

    const cpfNormalizado = normalizarCpf(dados.cpf);

    if (!validarCpf(cpfNormalizado)) {
      throw new Error('CPF inválido.');
    }

    if (this.buscarPorCpf(cpfNormalizado)) {
      throw new Error('Já existe uma criança cadastrada com esse CPF.');
    }

    const novaCrianca: Crianca = {
      ...dados,
      cpf: cpfNormalizado,
      id: crypto.randomUUID(),
      responsavelId: idResponsavelLogado,
    };

    this.criancas$$.next([...this.criancas$$.value, novaCrianca]);
    this.persistir();

    this.registroVacinalService.gerarCalendarioPara(novaCrianca);

    return novaCrianca;
  }

  atualizar(id: string, dados: Partial<CriancaForm>): void {
    const lista = this.criancas$$.value.map((crianca) =>
      crianca.id === id ? { ...crianca, ...dados, cpf: dados.cpf ? normalizarCpf(dados.cpf) : crianca.cpf } : crianca
    );
    this.criancas$$.next(lista);
    this.persistir();
  }

  // Remove a criança e, junto, todo o histórico vacinal dela — evita ficar
  // registro perdido sem nenhuma criança associada.
  remover(id: string): void {
    this.criancas$$.next(this.criancas$$.value.filter((crianca) => crianca.id !== id));
    this.persistir();
    this.registroVacinalService.removerPorCrianca(id);
  }

  private persistir(): void {
    this.storage.salvar(CHAVE_STORAGE, this.criancas$$.value);
  }
}
