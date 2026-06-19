export enum StatusVacina {
  APLICADA = 'APLICADA',
  EM_DIA = 'EM_DIA', // ainda dentro do prazo, não aplicada
  ATRASADA = 'ATRASADA', // prazo vencido, não aplicada
  FUTURA = 'FUTURA', // prazo recomendado ainda não chegou (opcional, útil pra UX)
}

/**
 * Metadados de apresentação por status, já alinhados à paleta
 * obrigatória do desafio. Centralizar aqui evita duplicar lógica de
 * cor/ícone espalhada pelos componentes.
 *
 * Paleta: #ABC270 (verde), #FEC868 (amarelo), #FDA769 (laranja), #473C33 (marrom escuro)
 */
export const STATUS_VACINA_CONFIG: Record<StatusVacina, { label: string; cor: string; icone: string }> = {
  [StatusVacina.APLICADA]: { label: 'Aplicada', cor: '#ABC270', icone: 'checkmark-circle' },
  [StatusVacina.EM_DIA]: { label: 'Em dia', cor: '#FEC868', icone: 'time' },
  [StatusVacina.ATRASADA]: { label: 'Atrasada', cor: '#FDA769', icone: 'alert-circle' },
  [StatusVacina.FUTURA]: { label: 'Futura', cor: '#473C33', icone: 'calendar' },
};

