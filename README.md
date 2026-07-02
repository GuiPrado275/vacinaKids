# 💉 Carteirinha — Acompanhamento de Vacinação Infantil

> Substitua a carteirinha física pelo celular. Cadastre seus filhos, acompanhe o calendário de vacinas do PNI e nunca perca um prazo.

🔗 **Acesse o sistema:** [https://vacina-kids-107ca.web.app](https://vacina-kids-107ca.web.app)

---

## O que é o Carteirinha?

O **Carteirinha** é uma aplicação web voltada para pais e responsáveis que precisam acompanhar a jornada de vacinação dos filhos. Ao cadastrar uma criança, o sistema gera automaticamente toda a carteira de vacinação dela — com base na data de nascimento e no calendário oficial do **PNI (Programa Nacional de Imunizações)** — sem que o responsável precise preencher nada manualmente.

O status de cada vacina (aplicada, em dia, atrasada ou futura) é **sempre calculado em tempo real**, com base na data atual, garantindo que as informações nunca fiquem desatualizadas.

---

## Como usar

### 1. Criando sua conta

Acesse [https://vacina-kids-107ca.web.app](https://vacina-kids-107ca.web.app) e clique em **"Cadastrar"**.

- O login é feito por **CPF** — sem necessidade de e-mail.
- Informe seu nome, CPF e crie uma senha.
- Sua conta é criada imediatamente e você já pode começar a usar.

### 2. Cadastrando uma criança

Na tela inicial, toque em **"Adicionar criança"**. Preencha:

- **Nome** da criança
- **Data de nascimento**

Pronto. O sistema gera automaticamente a carteira de vacinação completa da criança, com todas as vacinas do calendário do PNI organizadas por faixa etária — exatamente como na carteirinha física.

### 3. Acompanhando a vacinação

Clique em qualquer criança cadastrada para ver a carteira dela. Você verá:

- **Resumo numérico** com totais de vacinas aplicadas, em dia, atrasadas e futuras
- **Barra de progresso** mostrando o percentual de vacinas já aplicadas
- **Timeline por faixa etária** (Ao nascer, 2 meses, 4 meses, 1 ano etc.), igual à carteirinha física
- **Badge de status** em cada vacina:
  - 🟢 **Aplicada** — vacina já registrada como tomada
  - 🔵 **Em dia** — dentro do prazo recomendado
  - 🔴 **Atrasada** — prazo já passou e ainda não foi aplicada
  - ⚪ **Futura** — ainda não está no prazo

### 4. Registrando uma vacina aplicada

Na carteira da criança, clique no botão de confirmação ao lado da vacina. O sistema pedirá uma confirmação antes de registrar — ação que afeta um histórico de saúde, então não acontece por toque acidental.

Caso precise desfazer, basta clicar no botão de desfazer ao lado da vacina aplicada.

### 5. Gerenciando múltiplos filhos

Cada criança tem sua própria identidade visual (avatar, nome, idade) e uma carteira de vacinação completamente isolada. Nenhuma tela mistura dados de crianças diferentes. Use o menu de navegação para alternar entre elas.

### 6. Campanhas de vacinação

Na tela inicial, um bloco de destaque exibe as **campanhas de vacinação ativas** no momento. Clique em "Ver todas" para acessar a tela dedicada de campanhas, onde você pode visualizar campanhas passadas e futuras também.

### 7. Minha conta

No menu, acesse **"Minha conta"** para:

- Alterar seu nome
- Trocar sua senha (exige informar a senha atual por segurança)
- **Excluir sua conta** — remove todos os seus dados e os registros de suas crianças permanentemente

---

## Conta administradora — acesso para testes

O sistema possui uma conta de administrador com acesso a funcionalidades exclusivas de gestão. Use os dados abaixo para explorar essas funções:

| Campo | Valor |
|-------|-------|
| **CPF** | `111.111.111-11` |
| **Senha** | `admin123` |

### O que o administrador pode fazer a mais

#### Gerenciar campanhas de vacinação
Na tela de Campanhas, o admin vê botões extras de **criar**, **editar** e **remover** campanhas — que não aparecem para usuários comuns. Cada campanha possui nome, descrição, data de início e data de fim.

#### Gerenciar usuários cadastrados
No menu, o admin tem acesso à tela **"Gerenciar usuários"**, onde pode:

- Ver todos os responsáveis cadastrados no sistema (nome, CPF e quantas crianças cada um tem)
- **Remover qualquer usuário** — a remoção exclui o perfil do responsável e todas as crianças vinculadas a ele

> **Nota técnica:** a remoção pelo admin desabilita o acesso do usuário ao sistema via regras de segurança do Firestore. A conta de autenticação em si só pode ser deletada pelo próprio dono.

---

## Funcionalidades completas

### Autenticação e segurança
- Login por CPF, convertido internamente em e-mail sintético para o Firebase Authentication
- Sessão gerenciada pelo Firebase (token JWT com expiração real) — nenhum dado de sessão fica exposto no `localStorage`
- Acesso entre abas ou dispositivos sem login prévio é bloqueado pelas regras de segurança do Firestore
- Cada responsável acessa **apenas as próprias crianças** — garantido por regras de segurança no servidor, não apenas por filtro de tela

### Carteira de vacinação
- Calendário gerado automaticamente a partir da data de nascimento, com base no PNI
- Status calculado dinamicamente (nunca salvo), sempre atualizado com a data de hoje
- Timeline por faixa etária: Ao nascer, 2 meses, 4 meses, 6 meses, 9 meses, 12 meses, 15 meses, 2 anos, 4 anos, 5 anos, 9 anos, 10 anos
- Barra de progresso por criança
- Alerta visual destacado quando há vacinas atrasadas (visível já no card da lista inicial)
- Confirmação antes de marcar ou desfazer aplicação

### Campanhas de vacinação
- Bloco de campanhas ativas em destaque na tela inicial
- Tela dedicada com todas as campanhas (ativas, futuras e encerradas)
- Campanhas ativas aparecem primeiro, ordenadas por relevância
- Gestão completa (criar, editar, remover) para o administrador

### Múltiplos filhos
- Suporte ilimitado de crianças por conta
- Identidade visual individual por criança
- Navegação e histórico completamente isolados entre crianças

### Dados em tempo real
- Qualquer alteração (marcar vacina, criar campanha etc.) reflete na tela instantaneamente, sem precisar recarregar a página
- Alimentado pelo Firestore em modo reativo com RxJS

### Feedback de interface
- Toast de sucesso ou erro em **todas** as ações assíncronas, incluindo ações sem formulário próprio (marcar/desfazer vacina, remover campanha, remover usuário)
- Confirmação por diálogo antes de qualquer ação destrutiva ou irreversível

### Layout
- Responsivo para mobile, tablet e desktop
- Layout dedicado para telas maiores (não é apenas o mobile "esticado") — mais visível na tela de login e na listagem de usuários
- Paleta de cores semântica: cada cor tem um papel definido (ação principal, alerta, destaque)

---

## Stack utilizada

| Tecnologia | Papel |
|------------|-------|
| **Ionic Framework + Angular** | Framework principal, componentes de UI, roteamento |
| **Standalone Components** | Sem NgModules — arquitetura moderna do Angular |
| **Firebase Authentication** | Login, sessão e gerenciamento de credenciais |
| **Firestore** | Banco de dados em tempo real |
| **RxJS** | Fluxos reativos de dados (sessão, listas, registros) |
| **Firebase Hosting** | Hospedagem da aplicação |

---

## Estrutura do projeto

```
src/app/
├── auth/                    # Login e cadastro
├── criancas/
│   ├── lista/               # Tela inicial com cards das crianças e campanhas ativas
│   ├── formulario/          # Cadastro e edição de criança
│   └── detalhe/             # Carteira de vacinação completa por criança
├── campanhas/
│   ├── campanhas.page        # Listagem de todas as campanhas
│   └── formulario/          # Criação e edição de campanha (admin)
├── usuario/
│   ├── editar/              # Minha conta (nome, senha, exclusão)
│   └── gerenciamento/       # Gerenciar usuários (admin)
└── core/
    ├── model/               # Interfaces, enums e regras de cálculo
    ├── service/             # Acesso a dados (Firestore/Auth) e regras de negócio
    └── util/                # Funções utilitárias (CPF)
└── shared/
    ├── components/          # Componentes reutilizáveis (status-badge)
    ├── guards/              # Proteção de rotas (auth e admin)
    └── service/             # Serviços de apoio à UI (toast/feedback)
```

---

## Regras de segurança (Firestore)

As permissões são reforçadas **no servidor**, não apenas na interface:

- Usuário não autenticado → sem acesso a nenhuma coleção
- Usuário autenticado → acessa apenas seus próprios dados (crianças, registros vacinais)
- Administrador → acesso a todas as coleções (leitura e escrita)
- Campanhas → qualquer usuário autenticado pode ler; apenas admin pode criar, editar ou remover

---
