import { Routes } from '@angular/router';

import { authGuard } from './shared/guards/auth.guard';
import { adminGuard } from './shared/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'cadastro',
    loadComponent: () => import('./auth/cadastro/cadastro.page').then((m) => m.CadastroPage),
  },
  {
    path: 'criancas',
    loadComponent: () => import('./criancas/lista/lista-criancas.page').then((m) => m.ListaCriancasPage),
    canActivate: [authGuard],
  },
  {
    // Rota fixa 'nova' precisa vir ANTES de ':id' — senão o router tenta tratar "nova" como se fosse o :id de
    // uma criança e cai na rota errada (detalhe-crianca em vez de formulario-crianca).
    path: 'criancas/nova',
    loadComponent: () =>
      import('./criancas/formulario/formulario-crianca.page').then((m) => m.FormularioCriancaPage),
    canActivate: [authGuard],
  },
  {
    path: 'criancas/:id',
    loadComponent: () => import('./criancas/detalhe/detalhe-crianca.page').then((m) => m.DetalheCriancaPage),
    canActivate: [authGuard],
  },
  {
    path: 'campanhas',
    loadComponent: () => import('./campanhas/campanhas.page').then((m) => m.CampanhasPage),
    canActivate: [authGuard],
  },
  {
    // 'nova' antes de ':id/editar' pelo mesmo motivo de criancas/nova, e as duas rotas exigem
    // authGuard (logado) + adminGuard (e ser admin), só o admin pode criar ou editar campanha.
    path: 'campanhas/nova',
    loadComponent: () =>
      import('./campanhas/formulario/formulario-campanha.page').then((m) => m.FormularioCampanhaPage),
    canActivate: [authGuard, adminGuard],
  },
  {
    path: 'campanhas/:id/editar',
    loadComponent: () =>
      import('./campanhas/formulario/formulario-campanha.page').then((m) => m.FormularioCampanhaPage),
    canActivate: [authGuard, adminGuard],
  },
  {
    // Editar o próprio usuário (e-mail, senha, excluir conta), qualquer pessoa logada, admin ou não.
    path: 'usuario/editar',
    loadComponent: () =>
      import('./usuario/editar/editar-usuario.page').then((m) => m.EditarUsuarioPage),
    canActivate: [authGuard],
  },
  {
    // Gerenciamento de usuários, só o admin enxerga isso (ver link condicional em lista-criancas.page.html).
    path: 'admin/usuarios',
    loadComponent: () =>
      import('./usuario/gerenciamento/gerenciamento-usuarios.page').then((m) => m.GerenciamentoUsuariosPage),
    canActivate: [authGuard, adminGuard],
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
