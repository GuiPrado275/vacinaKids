export interface Crianca {
  id: string;
  nome: string;
  dataNascimento: string; // ISO 8601 (yyyy-MM-dd) — facilita serialização e comparação de datas
  responsavelId: string; // FK -> Responsavel.id
  foto?: string; // URL ou base64 do avatar; usado no seletor visual (Cenário 4)
  sexo?: 'F' | 'M' | 'NAO_INFORMADO';
}

/**
 * Payload usado para criar/editar uma criança.
 */
export type CriancaForm = Omit<Crianca, 'id'>;

/**
 * Função para calcular a idade em meses completos
 * a partir da data de nascimento. Usada tanto para exibição quanto
 * para decidir quais vacinas já "venceram" o prazo recomendado.
 */
export function calcularIdadeEmMeses(dataNascimento: string, dataReferencia: Date = new Date()): number {
  const nascimento = new Date(dataNascimento);
  let meses =
    (dataReferencia.getFullYear() - nascimento.getFullYear()) * 12 +
    (dataReferencia.getMonth() - nascimento.getMonth());

  if (dataReferencia.getDate() < nascimento.getDate()) {
    meses -= 1;
  }

  return Math.max(meses, 0);
}
