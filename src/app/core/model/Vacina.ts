export interface Vacina {
  id: string;
  nome: string; // ex.: "BCG", "Pentavalente", "Tríplice Viral"
  doseNumero: number; // 1ª dose, 2ª dose, reforço... (reforço pode ser representado como a última dose da série)
  idadeRecomendadaMeses: number; // idade, em meses, em que essa dose deveria ser tomada
  protegeContra: string; // texto informativo, ex.: "Tuberculose"
  observacoes?: string;
}

/**
 * Payload usado para criar/editar uma vacina no catálogo.
 */
export type VacinaForm = Omit<Vacina, 'id'>;
