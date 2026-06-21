// Quem realmente usa o app e faz login. A criança não loga em nada, então
// é o Responsavel que representa a "conta" no app.
//
// IMPORTANTE (migração pra Firebase): a senha NÃO mora mais aqui. Quem
// guarda e confere senha agora é o Firebase Authentication (de forma
// segura, com hash — nunca em texto puro). Esse documento no Firestore
// guarda só os dados de PERFIL do responsável; o `id` aqui é sempre o
// mesmo "uid" da conta dele no Firebase Auth, então os dois (conta de
// login e documento de perfil) ficam sempre ligados 1-para-1 pelo mesmo id.
export interface Responsavel {
  id: string; // == uid do Firebase Auth
  nome: string;
  cpf: string; // só números, sem pontuação - é o que usamos pro login (vira e-mail sintético por baixo, ver cpf.util.ts)
  email?: string; // e-mail real, opcional, diferente do e-mail sintético usado no Auth
  telefone?: string;
  // Marca a conta administradora (gestão de campanhas e de usuários).
  // Só existe uma conta assim, criada já no seed inicial do banco — não
  // há cadastro de admin pelo formulário público.
  isAdmin?: boolean;
}

// Formulário de cadastro: pede a senha (vai pro Firebase Auth, não pro
// Firestore), mas o documento de perfil salvo no Firestore nunca tem
// esse campo — daí o Omit duplo aqui.
export type ResponsavelForm = Omit<Responsavel, 'id'> & { senha: string };

// O que de fato vira o documento no Firestore (sem id, sem senha).
export type ResponsavelPerfil = Omit<Responsavel, 'id'>;
