# Carteirinha de Vacinação Infantil (Vacina Kids)

Aplicativo para acompanhamento da jornada de vacinação de crianças, desenvolvido como Desafio Técnico Cyrrus (Estágio Frontend). Permite que cada responsável cadastre seus filhos, acompanhe o calendário vacinal de cada um (vacinas aplicadas, em dia, atrasadas e futuras) e visualize campanhas de vacinação ativas. Inclui também uma área administrativa para gestão de campanhas e de usuários.

---

## 1. Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework | Angular (standalone components, sem NgModules) |
| UI | Ionic Framework (`@ionic/angular/standalone`) |
| Ícones | Ionicons (`ionicons/icons`, registrados via `addIcons`) |
| Backend / dados | Firebase (Firestore — banco de dados em tempo real) |
| Autenticação | Firebase Authentication (e-mail/senha, com e-mail sintético a partir do CPF) |
| Reatividade | RxJS (Observables) |
| Formulários | Angular Reactive Forms |
| Roteamento | Angular Router (lazy loading via `loadComponent`, guards funcionais) |

> Este `README` documenta o conteúdo da pasta `src/` enviada. Arquivos de configuração do projeto (`package.json`, `angular.json`, `firestore.rules`, etc.) não fazem parte deste pacote — os comentários do código fazem referência a um arquivo `firestore.rules` que define as regras de segurança do Firestore, mas esse arquivo não está entre os enviados aqui.

---

## 2. Paleta de cores (obrigatória pelo desafio)

| Cor | Hex | Papel no Ionic | Uso semântico |
|---|---|---|---|
| Verde-oliva | `#ABC270` | `primary` / `success` | Ações principais, vacina **aplicada** |
| Amarelo mel | `#FEC868` | `secondary` / `warning` | Destaques, campanhas, vacina **em dia** |
| Laranja | `#FDA769` | `tertiary` / `danger` (parcial) | Alertas, vacina **atrasada** |
| Marrom escuro | `#473C33` | Cor de texto/contraste da marca (`--ion-text-color`) | Texto, vacina **futura** |

Definidas em `src/theme/variables.scss`, com shade/tint calculados a partir do hex base (não chutados) e contraste WCAG escolhido entre preto/branco para cada cor.

---

## 3. Estrutura de pastas

```
src/app/
├── auth/                     # Login e cadastro de responsável
│   ├── login/
│   └── cadastro/
├── campanhas/                # Listagem + CRUD de campanhas (CRUD só admin)
│   └── formulario/
├── criancas/                 # Núcleo do app: lista, detalhe e cadastro de crianças
│   ├── lista/
│   ├── detalhe/
│   └── formulario/
├── usuario/
│   ├── editar/                # "Minha conta" — qualquer responsável logado
│   └── gerenciamento/          # Gestão de usuários — só admin
├── shared/
│   ├── components/status-badge/  # Badge reutilizável de status de vacina
│   └── guards/                   # authGuard e adminGuard
├── core/
│   ├── model/                 # Interfaces de domínio + funções puras de regra de negócio
│   ├── service/                # Acesso a dados (Firestore/Auth) e regras de negócio
│   └── util/                   # cpf.util.ts (validação/formatação de CPF)
├── app.routes.ts
├── app.component.ts
└── app.component.html
```

---

## 4. Modelo de dados (coleções do Firestore)

### `responsaveis`
Documento de **perfil** de cada conta (a senha não fica aqui — mora no Firebase Auth). O `id` do documento é sempre o mesmo `uid` da conta no Firebase Auth.

```ts
interface Responsavel {
  id: string;           // == uid do Firebase Auth
  nome: string;
  cpf: string;           // só números, usado como identidade de login
  email?: string;        // e-mail real de contato (opcional, diferente do e-mail sintético do Auth)
  telefone?: string;
  isAdmin?: boolean;     // marca a conta administradora
}
```

### `criancas`
```ts
interface Crianca {
  id: string;
  nome: string;
  cpf: string;
  dataNascimento: string;   // yyyy-MM-dd — base para calcular todo o calendário vacinal
  responsavelId: string;    // dono da criança (uid do responsável)
  foto?: string;
  sexo?: 'F' | 'M' | 'NAO_INFORMADO';
}
```

### `registrosVacinais`
Liga uma criança a uma vacina do catálogo. **Não guarda status** — o status (`APLICADA`, `EM_DIA`, `ATRASADA`, `FUTURA`) é sempre calculado na hora a partir das datas, nunca persistido (senão "atrasada" ficaria desatualizado com o tempo).

```ts
interface RegistroVacinal {
  id: string;
  criancaId: string;
  vacinaId: string;
  dataPrevista: string;          // dataNascimento + idadeRecomendadaMeses da vacina
  dataAplicacao: string | null;
  localAplicacao?: string;
  responsavelId: string;         // copiado da criança — necessário para as regras de segurança do Firestore funcionarem em queries de lista sem custo extra
}
```

Gerado automaticamente (todas as ~22 doses do catálogo de uma vez, via `writeBatch`) no momento em que uma criança é cadastrada.

### `campanhas`
Dado público, sem relação obrigatória com nenhuma criança específica.
```ts
interface Campanha {
  id: string;
  titulo: string;
  descricao: string;
  publicoAlvo: string;     // ex.: "0 a 5 anos"
  dataInicio: string;
  dataFim: string;
  vacinaRelacionadaId?: string;
}
```

### Catálogo de vacinas (não é uma coleção do Firestore)
Vive como constante em `VacinaService` (baseado no PNI simplificado, ~22 doses). É dado estático, igual para todas as crianças, por isso não foi modelado como coleção — não há ganho em pagar uma consulta de rede para algo que nunca muda em runtime.

---

## 5. Regra de cálculo do status da vacina

Função única (`calcularStatusVacina`, em `core/model/registro-vacinal.model.ts`), usada em todo o app para nunca duplicar essa lógica:

1. **Já tem `dataAplicacao`?** → `APLICADA`.
2. **Data prevista já passou e não foi aplicada?** → `ATRASADA`.
3. **Falta menos de 1 mês para a data prevista?** → `EM_DIA`.
4. **Senão** → `FUTURA` (não mostrada com urgência).

A mesma lógica de "campanha ativa hoje" (`campanhaEstaAtiva`) compara a data de hoje com o intervalo `dataInicio`–`dataFim` da campanha.

---

## 6. Autenticação

- Login é feito por **CPF + senha**, não por e-mail — mas o Firebase Authentication (modo e-mail/senha) exige um e-mail. A solução: um **e-mail sintético** é gerado a partir do CPF (`cpfParaEmailSintetico`, em `cpf.util.ts`), no formato `<cpf-só-números>@carteirinha.app`. Esse e-mail nunca é exibido para a pessoa nem usado para enviar e-mails reais.
- O campo `Responsavel.email` é **diferente**: é o e-mail real/opcional de contato, editável em "Minha conta" — os dois nunca se misturam.
- CPF é validado com o algoritmo oficial de dígito verificador da Receita Federal (`validarCpf`), e formatado visualmente (`000.000.000-00`) enquanto a pessoa digita.
- Sessão é gerenciada pelo Firebase Auth de verdade (token com expiração real), não mais por `localStorage` manual — abrir um link em outra aba/navegador sem ter feito login lá não dá acesso a nada.
- Cadastro **não loga automaticamente**: depois de criar a conta, a pessoa é redirecionada para `/login` (com mensagem de boas-vindas), e precisa entrar com a senha que acabou de criar — como a maioria dos apps reais.

### `AuthService` — stream central de sessão
`sessao$` é o Observable "oficial" que junta `{ usuario (Firebase Auth), responsavel (perfil no Firestore) }` **já sincronizados** entre si. É esse Observable que os guards de rota usam, evitando qualquer "flash" de decidir antes da hora (ex.: mandar para `/login` alguém que na verdade já está logado, só porque o Firestore ainda não respondeu).

---

## 7. Permissões — Responsável comum vs. Administrador

Existe **apenas um nível de permissão elevada**: o campo `Responsavel.isAdmin`. Não há cadastro de admin pelo formulário público — a conta administradora é criada manualmente (seed direto no Firestore/Firebase Auth), fora do fluxo do app.

### O que **qualquer responsável logado** pode fazer:
- Cadastrar, listar e ver o detalhe das **próprias** crianças (nunca de outro responsável).
- Marcar/desmarcar vacinas como aplicadas (com confirmação) — exceto vacinas `FUTURA`, que ficam bloqueadas mesmo se alguém tentar forçar (checagem duplicada: botão desabilitado na tela **e** validação no `RegistroVacinalService`).
- Ver a lista de campanhas (todas, e quais estão ativas agora).
- Editar e-mail de contato e trocar a própria senha em "Minha conta" (exige confirmar a senha atual, por exigência do Firebase Auth para operações sensíveis).
- Excluir a própria conta (remove crianças + registros vacinais + perfil + credencial, nessa ordem específica).

### O que **só o Administrador** (`isAdmin === true`) pode fazer:
- **Criar, editar e remover campanhas** (`/campanhas/nova`, `/campanhas/:id/editar`) — protegido por `adminGuard`. O botão (FAB) de criar campanha e os controles de editar/remover só aparecem na UI para o admin, mas a regra de negócio "de verdade" estaria nas regras de segurança do Firestore (escrita na coleção `campanhas` restrita a `isAdmin == true`).
- **Acessar o "Gerenciamento de usuários"** (`/admin/usuarios`) — lista todos os responsáveis cadastrados (exceto a própria conta admin), com nome, CPF formatado e quantas crianças cada um tem, e permite **remover qualquer usuário** (com confirmação).
- Ver o link/card de "Gerenciamento de usuários" na tela inicial (`lista-criancas`), que só é renderizado quando `ehAdmin()` é verdadeiro.

### O que o Administrador **não pode fazer** (limitações conscientes do projeto):
- **Não pode excluir a própria conta admin.** Tanto a UI ("Minha conta" simplesmente não mostra a opção) quanto o `ResponsavelService.remover` (defesa em profundidade — bloqueia mesmo se chamado diretamente) impedem isso. Sem essa trava, o app ficaria sem ninguém para gerenciar campanhas/usuários.
- **Ao remover outro usuário, a conta dele não é de fato apagada do Firebase Authentication** — só o documento de **perfil** no Firestore (e as crianças/registros dele). Isso é uma limitação técnica conhecida: o SDK do navegador só permite que uma conta exclua a si mesma; excluir a credencial de outra pessoa exigiria o Admin SDK rodando em um backend (ex. Cloud Functions), fora do escopo atual. Na prática, a conta "removida" fica inutilizável: sem documento de perfil, ela não consegue mais usar o app mesmo tentando logar de novo.

### Como a checagem de admin é decidida em cada rota
Todas as rotas administrativas usam dois guards em sequência:
1. `authGuard` — está logado? Se não, manda para `/login`.
2. `adminGuard` — é admin? Se não (mas está logado), manda para `/criancas` (não mostra erro, só não deixa entrar).

---

## 8. Rotas

| Rota | Página | Guards | Quem acessa |
|---|---|---|---|
| `/login` | `LoginPage` | — | Público |
| `/cadastro` | `CadastroPage` | — | Público |
| `/criancas` | `ListaCriancasPage` | `authGuard` | Logado |
| `/criancas/nova` | `FormularioCriancaPage` | `authGuard` | Logado |
| `/criancas/:id` | `DetalheCriancaPage` | `authGuard` | Logado (dono da criança) |
| `/campanhas` | `CampanhasPage` | `authGuard` | Logado |
| `/campanhas/nova` | `FormularioCampanhaPage` | `authGuard`, `adminGuard` | Admin |
| `/campanhas/:id/editar` | `FormularioCampanhaPage` | `authGuard`, `adminGuard` | Admin |
| `/usuario/editar` | `EditarUsuarioPage` | `authGuard` | Logado (admin incluso) |
| `/admin/usuarios` | `GerenciamentoUsuariosPage` | `authGuard`, `adminGuard` | Admin |
| `''` | redireciona para `/login` | — | — |

> Nota de ordenação: rotas fixas como `criancas/nova` e `campanhas/nova` precisam vir **antes** das rotas com parâmetro (`criancas/:id`, `campanhas/:id/editar`) em `app.routes.ts` — senão o Angular Router tentaria interpretar `"nova"` como um `:id`.

---

## 9. Cenários do desafio → onde cada um foi resolvido

| Cenário | Implementação |
|---|---|
| 1 — Ver o que já foi feito e o que falta | Cards de resumo (`resumo-cards`) e barra de progresso em `DetalheCriancaPage`; resumo + barra também no card de cada criança em `ListaCriancasPage`. |
| 2 — Identificar pendência (vacina atrasada) | Badge/alerta vermelho-laranja (`alerta-atraso`, `alerta-pendencia`) calculado por `calcularStatusVacina`; aparece tanto no card da lista quanto no detalhe. |
| 3 — Campanha ativa visível | Bloco "Campanhas ativas" na tela inicial (`lista-criancas`) + tela dedicada `/campanhas`, filtrando por `campanhaEstaAtiva`. |
| 4 — Múltiplos filhos, históricos isolados | `criancas` é uma coleção filtrada sempre por `responsavelId`; cada `DetalheCriancaPage` busca por `:id` específico — nenhum dado de uma criança aparece misturado com outra. |

---

## 10. Configuração do Firebase

O app usa `@angular/fire` com **functional providers** (sem NgModule), configurado em `src/main.ts`:

```ts
provideFirebaseApp(() => initializeApp(environment.firebase)),
provideAuth(() => getAuth()),
provideFirestore(() => getFirestore()),
```

As chaves do projeto Firebase ficam em `src/environments/environment.ts` (dev) e `environment.prod.ts` (build de produção — troca automática via `fileReplacements` no `angular.json`, que não está incluso neste pacote).

> ⚠️ **Atenção para repositório público no GitHub:** este projeto já tem uma `apiKey` do Firebase preenchida nos dois arquivos de `environments`. A `apiKey` do Firebase Web **não é, por si só, um segredo** (ela é enviada ao navegador de qualquer forma) — a segurança real do banco depende das **regras de segurança do Firestore** (`firestore.rules`, referenciado nos comentários do código mas não incluído neste `src.zip`). Antes de publicar o repositório, vale a pena: confirmar que as regras do Firestore estão configuradas corretamente no Console do Firebase (não deixar o banco em modo de teste aberto) e, como boa prática, considerar restringir a `apiKey` por domínio no Console do Google Cloud.

### Como rodar localmente
1. Ter um projeto Firebase criado, com **Authentication** (provedor E-mail/senha habilitado) e **Firestore Database** ativos.
2. Conferir/substituir o bloco `firebase: {...}` em `environment.ts` pelas credenciais do seu projeto (Firebase Console → Configurações do projeto → SDK setup and configuration).
3. Configurar as regras de segurança do Firestore (coleções `responsaveis`, `criancas`, `registrosVacinais`, `campanhas`) — sem isso, todas as queries autenticadas serão recusadas com "permission denied".
4. `npm install`
5. `ionic serve` (ou `ng serve`)

---

## 11. Decisões de arquitetura que vale destacar

- **Separação Auth vs. Perfil:** `AuthService` cuida só de sessão/credencial (Firebase Auth); `ResponsavelService` cuida só do documento de perfil (Firestore). Os dois são amarrados pelo mesmo `id`/`uid`.
- **Status nunca é persistido**, sempre calculado (vacina e campanha) — evita dado desatualizado com o tempo.
- **`responsavelId` desnormalizado** em `registrosVacinais` (copiado da criança), para que as regras de segurança do Firestore consigam filtrar listas (`list`) sem precisar de um `get()` extra por documento.
- **Componente único de status** (`StatusBadgeComponent`) é a única fonte visual de cor/ícone por status — qualquer tela que precise mostrar status usa esse componente, nunca decide cor sozinha.
- **Guards funcionais** (`authGuard`, `adminGuard`), sem classes — padrão recomendado para apps 100% standalone.
