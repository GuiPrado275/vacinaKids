// Catálogo de vacinas (PNI). É dado fixo, igual pra todas as crianças, não pertence a nenhuma em específico.

export interface Vacina {
  id: string;
  nome: string; // BCG, Pentavalente, Tríplice Viral...
  doseNumero: number;
  idadeRecomendadaMeses: number;
  protegeContra: string;
  observacoes?: string;
}

export type VacinaForm = Omit<Vacina, 'id'>;
