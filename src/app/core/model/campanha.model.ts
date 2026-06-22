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
// Comparação feita por string "YYYY-MM-DD" para evitar bug de fuso horário
export function campanhaEstaAtiva(campanha: Pick<Campanha, 'dataInicio' | 'dataFim'>, dataReferencia: Date = new Date()): boolean {
  const hoje = dataReferencia.toLocaleDateString('sv-SE'); // formato "YYYY-MM-DD" sempre

  return hoje >= campanha.dataInicio && hoje <= campanha.dataFim;
}
