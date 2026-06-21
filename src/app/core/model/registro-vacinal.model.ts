import { StatusVacina } from './enum/status-vacina.enum';

// Liga uma criança a uma vacina do catálogo: quando deveria ter sido
// tomada e quando (se foi) foi aplicada de fato.
// Não tem campo "status" aqui de propósito — ele é calculado na hora,
// não fica salvo (senão "atrasada" ficaria desatualizado com o tempo).

export interface RegistroVacinal {
  id: string;
  criancaId: string;
  vacinaId: string;
  dataPrevista: string; // Calculada a partir de Crianca.dataNascimento + Vacina.idadeRecomendadaMeses
  dataAplicacao: string | null;
  localAplicacao?: string;
  // Cópia (desnormalizada) do responsavelId da criança dona desse
  // registro. Em bancos relacionais isso seria redundante (já dá pra
  // fazer JOIN), mas no Firestore as regras de segurança não conseguem
  // checar "o dono da criança associada" pra cada documento de uma QUERY
  // sem custo proibitivo (cada `get()` extra conta pro limite de acessos
  // a documento, multiplicado por documento listado — ver
  // firestore.rules). Copiar o dono direto pro registro permite que a
  // regra de `list` funcione exatamente igual à de /criancas: barata e
  // sem get() extra. Tradeoff aceito: se uma criança um dia trocasse de
  // responsável (não acontece hoje no app), esse campo precisaria ser
  // atualizado junto — não é uma operação que a UI expõe.
  responsavelId: string;
}

export type RegistroVacinalForm = Omit<RegistroVacinal, 'id'>;

// Soma a idade recomendada (em meses) à data de nascimento da criança.
export function calcularDataPrevista(dataNascimento: string, idadeRecomendadaMeses: number): string {
  const data = new Date(dataNascimento);
  data.setMonth(data.getMonth() + idadeRecomendadaMeses);
  return data.toISOString().slice(0, 10);
}

// Única função que decide o status de um registro, evita duplicar essa lógica em outras telas.
// Três perguntas em ordem: já foi aplicada? a data já passou? está chegando?
export function calcularStatusVacina(
  registro: Pick<RegistroVacinal, 'dataPrevista' | 'dataAplicacao'>,
  dataReferencia: Date = new Date()
): StatusVacina {
  // Primeira pergunta: a vacina já foi aplicada? Se sim, encerra aqui.
  if (registro.dataAplicacao) return StatusVacina.APLICADA;

  const previsao = new Date(registro.dataPrevista);
  const hoje = new Date(dataReferencia.toDateString());

  // Um mês antes da data prevista — a partir daí a vacina começa a "aparecer no radar".
  const umMesAntes = new Date(previsao);
  umMesAntes.setMonth(umMesAntes.getMonth() - 1);

  // Segunda pergunta: a data prevista já passou sem ser aplicada? Está atrasada.
  if (previsao.getTime() < hoje.getTime()) return StatusVacina.ATRASADA;

  // Terceira: falta menos de um mês? Está em dia (próxima a vencer).
  // Se não, ainda é futura — não vale a pena mostrar com urgência.
  if (hoje.getTime() >= umMesAntes.getTime()) return StatusVacina.EM_DIA;
  return StatusVacina.FUTURA;
}
