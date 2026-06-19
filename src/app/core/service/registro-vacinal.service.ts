import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

import { Crianca } from '../model/crianca.model';
import { Vacina } from '../model/vacina.model';
import { RegistroVacinal, calcularDataPrevista, calcularStatusVacina } from '../model/registro-vacinal.model';
import { StatusVacina } from '../model/enum/status-vacina.enum';
import { StorageService } from './storage.service';
import { VacinaService } from './vacina.service';

const CHAVE_STORAGE = 'vacina_app_registros';

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
@Injectable({ providedIn: 'root' })
export class RegistroVacinalService {
  // Mesmo cuidado dos outros services: montamos o BehaviorSubject dentro
  // do construtor, depois que "this.storage" já está garantidamente
  // disponível.
  private readonly registros$$: BehaviorSubject<RegistroVacinal[]>;

  constructor(
    private storage: StorageService,
    private vacinaService: VacinaService
  ) {
    this.registros$$ = new BehaviorSubject<RegistroVacinal[]>(
      this.storage.obter<RegistroVacinal[]>(CHAVE_STORAGE) ?? []
    );
  }

  // Cria um registro pra cada vacina do catálogo, já com a data prevista
  // calculada a partir do nascimento da criança (usa calcularDataPrevista,
  // que já existe no model). É chamado uma única vez, no momento em que a
  // criança é cadastrada (ver CriancaService) — não precisa ser chamado
  // de novo depois.
  gerarCalendarioPara(crianca: Crianca): void {
    const novosRegistros: RegistroVacinal[] = this.vacinaService.listarSincrono().map((vacina) => ({
      id: crypto.randomUUID(),
      criancaId: crianca.id,
      vacinaId: vacina.id,
      dataPrevista: calcularDataPrevista(crianca.dataNascimento, vacina.idadeRecomendadaMeses),
      dataAplicacao: null,
    }));

    this.registros$$.next([...this.registros$$.value, ...novosRegistros]);
    this.persistir();
  }

  // Registros "crus" de uma criança, sem juntar com a vacina ainda.
  listarPorCrianca(criancaId: string): Observable<RegistroVacinal[]> {
    return this.registros$$.asObservable().pipe(
      map((registros) => registros.filter((registro) => registro.criancaId === criancaId))
    );
  }

  // Versão completa, já com nome/dados da vacina e status calculado,
  // ordenada pela data prevista. É essa que a tela da carteira de
  // vacinação de uma criança específica deve usar.
  listarDetalhadoPorCrianca(criancaId: string): Observable<RegistroDetalhado[]> {
    return combineLatest([this.listarPorCrianca(criancaId), this.vacinaService.listar()]).pipe(
      map(([registros, vacinas]) => this.detalharLista(registros, vacinas))
    );
  }

  // Atende ao Cenário 2 do desafio: vacinas com data prevista no passado
  // que ainda não foram aplicadas. Sem informar criancaId, devolve as
  // pendências de todas as crianças do responsável — útil pra um aviso
  // geral na tela inicial, por exemplo.
  listarPendencias(criancaId?: string): Observable<RegistroDetalhado[]> {
    return combineLatest([this.registros$$.asObservable(), this.vacinaService.listar()]).pipe(
      map(([registros, vacinas]) => {
        const filtrados = criancaId ? registros.filter((registro) => registro.criancaId === criancaId) : registros;
        return this.detalharLista(filtrados, vacinas).filter((registro) => registro.status === StatusVacina.ATRASADA);
      })
    );
  }

  // Atende ao Cenário 1: resumo pronto pra exibir num card/indicador visual
  // (ex.: barra de progresso "8 de 12 vacinas aplicadas").
  //
  // Observação: hoje calcularStatusVacina (no model) nunca devolve
  // StatusVacina.FUTURA — vacinas que ainda não venceram entram como
  // EM_DIA. Deixamos o contador "futuras" já pronto aqui pra não precisar
  // tocar nesse service caso decidam separar esses dois casos depois.
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
  registrarAplicacao(registroId: string, dataAplicacao: string, localAplicacao?: string): void {
    this.atualizarRegistro(registroId, { dataAplicacao, localAplicacao });
  }

  // Caso o responsável marque por engano, desfaz e o status volta a ser
  // calculado normalmente a partir da data prevista.
  desfazerAplicacao(registroId: string): void {
    this.atualizarRegistro(registroId, { dataAplicacao: null, localAplicacao: undefined });
  }

  // Limpeza usada quando uma criança é removida do app, pra não deixar
  // registro órfão guardado sem necessidade.
  removerPorCrianca(criancaId: string): void {
    this.registros$$.next(this.registros$$.value.filter((registro) => registro.criancaId !== criancaId));
    this.persistir();
  }

  private atualizarRegistro(registroId: string, dados: Partial<RegistroVacinal>): void {
    const lista = this.registros$$.value.map((registro) =>
      registro.id === registroId ? { ...registro, ...dados } : registro
    );
    this.registros$$.next(lista);
    this.persistir();
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

  private persistir(): void {
    this.storage.salvar(CHAVE_STORAGE, this.registros$$.value);
  }
}
