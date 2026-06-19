import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Campanha, CampanhaForm, campanhaEstaAtiva } from '../model/campanha.model';
import { StorageService } from './storage.service';

const CHAVE_STORAGE = 'vacina_app_campanhas';

// Campanha é informação pública, não pertence a uma criança específica
// (igual já está explicado no model Campanha.ts). Por isso esse service
// é mais simples: não precisa filtrar por responsável nem cruzar com
// registro vacinal.
@Injectable({ providedIn: 'root' })
export class CampanhaService {
  // Mesmo cuidado do ResponsavelService: montamos o BehaviorSubject dentro
  // do construtor, depois que "this.storage" já está garantidamente
  // disponível, em vez de usá-lo direto no inicializador do campo.
  private readonly campanhas$$: BehaviorSubject<Campanha[]>;

  constructor(private storage: StorageService) {
    this.campanhas$$ = new BehaviorSubject<Campanha[]>(
      this.storage.obter<Campanha[]>(CHAVE_STORAGE) ?? this.campanhasIniciais()
    );
  }

  // Duas campanhas de exemplo: uma rolando agora e outra só no futuro.
  // Isso deixa fácil ver a diferença entre listar() e listarAtivas()
  // durante a avaliação, sem precisar cadastrar nada na mão.
  private campanhasIniciais(): Campanha[] {
    return [
      {
        id: 'campanha-multivacinacao',
        titulo: 'Campanha de Multivacinação',
        descricao: 'Atualize a caderneta de vacinação das crianças de 0 a 5 anos em qualquer posto de saúde.',
        publicoAlvo: '0 a 5 anos',
        dataInicio: '2026-06-01',
        dataFim: '2026-06-30',
      },
      {
        id: 'campanha-febre-amarela',
        titulo: 'Campanha de Febre Amarela',
        descricao: 'Reforço da vacina de febre amarela para crianças a partir de 9 meses.',
        publicoAlvo: '9 meses a 5 anos',
        dataInicio: '2026-08-01',
        dataFim: '2026-08-31',
        vacinaRelacionadaId: 'febre-amarela',
      },
    ];
  }

  listar(): Observable<Campanha[]> {
    return this.campanhas$$.asObservable();
  }

  // Atende ao Cenário 3 do desafio: o responsável precisa ver as
  // campanhas que estão rolando hoje, não as que já passaram ou que
  // ainda vão começar (usa campanhaEstaAtiva, que já existe no model).
  listarAtivas(): Observable<Campanha[]> {
    return this.campanhas$$.asObservable().pipe(
      map((campanhas) => campanhas.filter((campanha) => campanhaEstaAtiva(campanha)))
    );
  }

  buscarPorId(id: string): Campanha | undefined {
    return this.campanhas$$.value.find((campanha) => campanha.id === id);
  }

  cadastrar(dados: CampanhaForm): Campanha {
    const novaCampanha: Campanha = { ...dados, id: crypto.randomUUID() };
    this.campanhas$$.next([...this.campanhas$$.value, novaCampanha]);
    this.persistir();
    return novaCampanha;
  }

  atualizar(id: string, dados: Partial<CampanhaForm>): void {
    const lista = this.campanhas$$.value.map((campanha) => (campanha.id === id ? { ...campanha, ...dados } : campanha));
    this.campanhas$$.next(lista);
    this.persistir();
  }

  remover(id: string): void {
    this.campanhas$$.next(this.campanhas$$.value.filter((campanha) => campanha.id !== id));
    this.persistir();
  }

  private persistir(): void {
    this.storage.salvar(CHAVE_STORAGE, this.campanhas$$.value);
  }
}
