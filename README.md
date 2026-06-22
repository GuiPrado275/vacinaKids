# Carteirinha — Acompanhamento de Vacinação Infantil

https://vacina-kids-107ca.web.app/criancas

Aplicação desenvolvida para o desafio técnico de estágio da **Cyrrus**, com o objetivo de ajudar pais e responsáveis a acompanhar a jornada de vacinação de seus filhos, substituindo parte da dependência da carteira física de vacinação.

## Stack utilizada

- **Ionic Framework + Angular** (standalone components, sem NgModules)
- **Firebase Authentication** — login e cadastro por CPF (convertido em e-mail sintético internamente)
- **Firestore** — banco de dados em tempo real
- **RxJS** — fluxos reativos de dados (sessão, listas de crianças, registros vacinais)

## Como o desafio foi interpretado

A regra de negócio central é: **cada criança nasce com um calendário de vacinas completo**, gerado automaticamente a partir da data de nascimento informada, usando como referência o catálogo de vacinas do PNI (Programa Nacional de Imunizações). O responsável não precisa montar nada manualmente — ele cadastra a criança e a carteira de vacinação já aparece pronta, com o status de cada vacina.

O **status de cada vacina nunca é salvo, é sempre calculado** (aplicada, em dia, atrasada ou futura), porque uma vacina "atrasada" depende da data de hoje — se fosse salva, ficaria desatualizada com o tempo.

### Cenários do desafio

| Cenário | Onde foi resolvido |
|---|---|
| 1. Identificar vacinas feitas e pendentes | Carteira de vacinação por criança, com timeline agrupada por faixa etária (igual à carteirinha física), resumo numérico e barra de progresso |
| 2. Vacina com data prevista ultrapassada | Badge de status "Atrasada", alerta visual destacado na tela da criança e indicador no card da lista inicial |
| 3. Campanha de vacinação ativa | Bloco de campanhas ativas em destaque na tela inicial + tela dedicada de campanhas, com gestão completa (criar/editar/remover) para o usuário administrador |
| 4. Mais de um filho, sem confundir históricos | Cada criança tem identidade visual própria (avatar, nome, idade) e navegação isolada — nenhuma tela mistura dados de crianças diferentes |

### Autenticação e permissões

- Login por CPF (sem necessidade de e-mail), com Firebase Authentication cuidando da senha e da sessão de verdade — nada fica em `localStorage` "na mão".
- Existe uma única conta administradora (criada previamente no banco), que pode gerenciar campanhas e usuários cadastrados. As regras de segurança do Firestore reforçam essa permissão no servidor, não só na interface.
- Cada responsável só acessa as próprias crianças — garantido pelas regras do Firestore, não apenas por filtro de tela.

### Diferenciais implementados

- **Firestore** e dados em tempo real (qualquer alteração reflete na tela sem precisar recarregar).
- Paleta de cores obrigatória do desafio aplicada de forma semântica (cada cor tem um papel — ação principal, alerta, destaque — em vez de usada solta).
- Indicadores visuais: badges de status, barra de progresso por criança, alertas de pendência.
- Layout responsivo dedicado para desktop/tablet (não é só o mobile "esticado") — visível principalmente na tela de login.
- Feedback de erro e sucesso (toast) em todas as ações assíncronas, incluindo as que não têm formulário próprio (marcar/desfazer vacina aplicada, remover campanha), para que nenhuma ação falhe sem o usuário saber.

## Como rodar localmente

```bash
npm install
ionic serve
```

> O arquivo `src/environments/environment.ts` já contém a configuração do projeto Firebase usado no desenvolvimento. Para apontar para outro projeto Firebase, substitua o bloco `firebaseConfig`.

## Publicação

Recomendado via **Firebase Hosting**, já que o projeto já usa Firebase para Auth e Firestore:

```bash
ionic build
firebase deploy --only hosting
```

## Estrutura do projeto

```
src/app/
├── auth/              # Login e cadastro
├── criancas/           # Lista, formulário e carteira de vacinação por criança
├── campanhas/          # Listagem e gestão de campanhas de vacinação
├── usuario/            # Edição de conta e gerenciamento de usuários (admin)
├── core/
│   ├── model/          # Interfaces e regras de cálculo (status, idade, datas)
│   ├── service/         # Acesso a dados (Firestore/Auth) e regras de negócio
│   └── util/            # Funções utilitárias (CPF)
└── shared/
    ├── components/      # Componentes reutilizáveis (ex.: status-badge)
    ├── guards/           # Proteção de rotas (autenticação e admin)
    └── service/          # Serviços de apoio à UI (ex.: feedback/toast)
```
