// dataNascimento não é só pra mostrar idade é a partir dela que calculamos quando cada vacina deveria ser tomada.

export interface Crianca {
  id: string;
  nome: string;
  cpf: string; // só números, sem pontuação - necessário pra cadastrar a criança pra tomar vacina
  dataNascimento: string; // yyyy-MM-dd
  responsavelId: string;
  foto?: string;
  sexo?: 'F' | 'M' | 'NAO_INFORMADO';
}

export type CriancaForm = Omit<Crianca, 'id'>;

// Idade em meses completos, usada pra cruzar com a idade recomendada das vacinas.
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
