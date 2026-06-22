export interface Responsavel {
  id: string; // == uid do Firebase Auth
  nome: string;
  cpf: string; // só números, sem pontuação - é o que usamos pro login (vira e-mail sintético por baixo, ver cpf.util.ts)
  email?: string;
  telefone?: string;
  isAdmin?: boolean;
}

// Formulário de cadastro: pede a senha (vai pro Firebase Auth, não pro Firestore), mas o documento de perfil salvo
// no Firestore nunca tem esse campo, daí o Omit duplo aqui.
export type ResponsavelForm = Omit<Responsavel, 'id'> & { senha: string };

// O que de fato vira o documento no Firestore (sem id, sem senha).
export type ResponsavelPerfil = Omit<Responsavel, 'id'>;
