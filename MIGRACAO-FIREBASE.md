# Migração para Firebase — Instruções

Este projeto foi migrado de armazenamento local (localStorage) para
Firebase (Authentication + Firestore). Siga os passos abaixo para rodar.

## 1. Instalar as novas dependências

O projeto agora depende de `@angular/fire` e `firebase`. Rode:

```bash
npm install @angular/fire firebase
```

(As demais dependências do projeto continuam as mesmas de antes.)

## 2. Publicar as regras de segurança do Firestore

O arquivo `firestore.rules` (na raiz do projeto) contém as regras de
segurança que precisam estar publicadas no Firebase Console para o app
funcionar corretamente e com segurança.

1. Acesse o Firebase Console (console.firebase.google.com) → seu
   projeto → **Build → Firestore Database → aba "Rules"**.
2. Apague o conteúdo atual e cole o conteúdo inteiro de `firestore.rules`.
3. Clique em **Publish**.

Sem esse passo, o banco continua no "modo teste" (libera tudo por 30 dias)
ou, se esse prazo já tiver passado, bloqueia tudo por padrão.

## 3. Conta de administrador

A conta admin **não é criada pelo cadastro público do app** — ela precisa
existir manualmente, uma única vez:

- **Authentication → Users → Add user**
  - Email: `11111111111@carteirinha.app`
  - Password: `admin123`
- **Firestore Database → Data → coleção `responsaveis`** → novo documento
  com **ID = uid** copiado do usuário criado acima, contendo:
  - `nome` (string): `Administrador`
  - `cpf` (string): `11111111111`
  - `isAdmin` (boolean): `true`

Na tela de login do app, essa conta entra normalmente com CPF
`111.111.111-11` e senha `admin123`.

## 4. O que mudou (resumo técnico)

- **Sessão/login**: antes era um id salvo "na mão" em `localStorage`
  (qualquer aba/navegador no mesmo domínio entrava logado). Agora é o
  Firebase Authentication de verdade — login, logout e expiração de sessão
  reais, por dispositivo/navegador autenticado.
- **Dados**: `responsaveis`, `criancas`, `registrosVacinais` e `campanhas`
  agora são coleções do Firestore, em tempo real, em vez de arrays em
  `localStorage`. O catálogo de vacinas (`VacinaService`) continua estático
  no código — é dado fixo, igual pra todo mundo.
- **CPF como login**: o Firebase Auth exige e-mail. O CPF informado vira
  um "e-mail sintético" internamente (`{cpf}@carteirinha.app`, ver
  `cpf.util.ts`), mas a pessoa nunca vê isso — ela sempre loga digitando o
  CPF.
- **Limitação conhecida**: quando o admin remove um usuário pela tela de
  gerenciamento, isso apaga o perfil e os dados dele no Firestore, mas
  **não** apaga a conta dele no Firebase Authentication — o SDK do
  navegador só permite que uma conta delete a si mesma. A conta fica
  "órfã" no Authentication, porém inutilizável (sem perfil no Firestore,
  as regras de segurança bloqueiam qualquer ação). Resolver isso de forma
  completa exigiria uma Cloud Function com Admin SDK (fora do escopo
  atual, e exige plano Blaze).
