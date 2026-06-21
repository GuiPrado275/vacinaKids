// Quem realmente usa o app e faz login. A criança não loga em nada, então
// as credenciais (cpf + senha) ficam aqui, nunca na Crianca.

export interface Responsavel {
  id: string;
  nome: string;
  cpf: string; // só números, sem pontuação - é o que usamos pro login
  senha: string;
  email?: string;
  telefone?: string;
  // Marca a conta administradora (gestão de campanhas e de usuários).
  // Só existe uma conta assim, criada já no seed do ResponsavelService —
  // não há cadastro de admin pelo formulário público.
  isAdmin?: boolean;
}

export type ResponsavelForm = Omit<Responsavel, 'id'>;
