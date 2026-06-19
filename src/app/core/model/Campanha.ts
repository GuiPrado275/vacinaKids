export interface Campanha {
  id: string;
  titulo: string;
  descricao: string;
  publicoAlvo: string; // ex.: "0 a 5 anos"
  dataInicio: string; // ISO 8601
  dataFim: string; // ISO 8601
  vacinaRelacionadaId?: string; // FK opcional -> Vacina.id
}

/**
 * Payload usado para criar/editar uma campanha.
 */
export type CampanhaForm = Omit<Campanha, 'id'>;

/**
 * Indica se uma campanha está ativa na data de referência (hoje, por
 * padrão). Útil para o Cenário 3 do desafio ("campanha ativa para
 * determinado público infantil").
 */
export function campanhaEstaAtiva(campanha: Pick<Campanha, 'dataInicio' | 'dataFim'>, dataReferencia: Date = new Date()): boolean {
  const inicio = new Date(campanha.dataInicio);
  const fim = new Date(campanha.dataFim);
  const hoje = new Date(dataReferencia.toDateString());

  return hoje.getTime() >= inicio.getTime() && hoje.getTime() <= fim.getTime();
}
