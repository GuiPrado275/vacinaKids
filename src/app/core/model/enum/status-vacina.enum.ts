// Status é sempre calculado, nunca salvo, porque "atrasada" depende da data de hoje.

export enum StatusVacina {
  APLICADA = 'APLICADA',
  EM_DIA = 'EM_DIA',
  ATRASADA = 'ATRASADA',
  FUTURA = 'FUTURA',
}

// Cor e ícone de cada status, já na paleta do desafio.
export const STATUS_VACINA_CONFIG: Record<StatusVacina, { label: string; cor: string; icone: string }> = {
  [StatusVacina.APLICADA]: { label: 'Aplicada', cor: '#ABC270', icone: 'checkmark-circle' },
  [StatusVacina.EM_DIA]: { label: 'Em dia', cor: '#FEC868', icone: 'time' },
  [StatusVacina.ATRASADA]: { label: 'Atrasada', cor: '#FDA769', icone: 'alert-circle' },
  [StatusVacina.FUTURA]: { label: 'Futura', cor: '#473C33', icone: 'calendar' },
};
