// Campanha é independente das crianças cadastradas, não tem chave estrangeira obrigatória,
// é informação pública (like: campanha de gripe).

export interface Campanha {
  id: string;
  titulo: string;
  descricao: string;
  publicoAlvo: string; // ex.: "0 a 5 anos"
  dataInicio: string;
  dataFim: string;
  vacinaRelacionadaId?: string;
}

export type CampanhaForm = Omit<Campanha, 'id'>;

// Diz se a campanha está rolando hoje ou na data passada.
export function campanhaEstaAtiva(campanha: Pick<Campanha, 'dataInicio' | 'dataFim'>, dataReferencia: Date = new Date()): boolean {
  const inicio = new Date(campanha.dataInicio);
  const fim = new Date(campanha.dataFim);
  const hoje = new Date(dataReferencia.toDateString());

  return hoje.getTime() >= inicio.getTime() && hoje.getTime() <= fim.getTime();
}
