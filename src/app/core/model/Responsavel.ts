export interface Responsavel {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
}

/**
 * Payload usado para criar/editar um responsável (sem o id, que é
 * gerado pelo serviço/banco).
 */
export type ResponsavelForm = Omit<Responsavel, 'id'>;
