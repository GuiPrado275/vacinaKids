import { StatusVacina } from './status-vacina.enum';

/**
 * Entidade de relacionamento entre `Crianca` e `Vacina`.
 *
 * É o "evento" que conecta uma criança específica a uma dose do
 * catálogo: quando deveria ter sido tomada e quando (se já foi) foi
 * de fato aplicada.
 *
 * Propositalmente NÃO existe um campo `status` aqui. Status é
 * derivado em tempo de leitura por `calcularStatusVacina`, pois
 * depende da data atual — guardá-lo como dado fixo o deixaria
 * desatualizado no dia seguinte à mudança de data.
 */
export interface RegistroVacinal {
  id: string;
  criancaId: string; // FK -> Crianca.id
  vacinaId: string; // FK -> Vacina.id
  dataPrevista: string; // ISO 8601 — calculada a partir de Crianca.dataNascimento + Vacina.idadeRecomendadaMeses
  dataAplicacao: string | null; // ISO 8601 ou null se ainda não foi tomada
  localAplicacao?: string;
}

/**
 * Payload usado para criar um registro vacinal (geralmente gerado
 * automaticamente ao cadastrar uma criança, a partir do catálogo de
 * vacinas).
 */
export type RegistroVacinalForm = Omit<RegistroVacinal, 'id'>;

/**
 * Calcula `dataPrevista` somando a idade recomendada (em meses) à
 * data de nascimento da criança.
 */
export function calcularDataPrevista(dataNascimento: string, idadeRecomendadaMeses: number): string {
  const data = new Date(dataNascimento);
  data.setMonth(data.getMonth() + idadeRecomendadaMeses);
  return data.toISOString().slice(0, 10); // yyyy-MM-dd
}

/**
 * Deriva o `StatusVacina` de um registro com base na data prevista,
 * na data de aplicação (se houver) e na data de referência (hoje,
 * por padrão). Esta é a única fonte de verdade para "status" —
 * nenhuma outra parte do código deve calcular isso de outra forma.
 */
export function calcularStatusVacina(
  registro: Pick<RegistroVacinal, 'dataPrevista' | 'dataAplicacao'>,
  dataReferencia: Date = new Date()
): StatusVacina {
  if (registro.dataAplicacao) {
    return StatusVacina.APLICADA;
  }

  const previsao = new Date(registro.dataPrevista);
  const hoje = new Date(dataReferencia.toDateString()); // zera horas para comparar só a data

  if (previsao.getTime() < hoje.getTime()) {
    return StatusVacina.ATRASADA;
  }

  return StatusVacina.EM_DIA;
}
