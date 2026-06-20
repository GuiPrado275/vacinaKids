import { Routes } from '@angular/router';

import { authGuard } from './shared/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'criancas',
    loadComponent: () => import('./criancas/lista/lista-criancas.page').then((m) => m.ListaCriancasPage),
    canActivate: [authGuard],
  },
  {
    // Rota fixa 'nova' precisa vir ANTES de ':id' — senão o router tenta
    // tratar "nova" como se fosse o :id de uma criança e cai na rota
    // errada (detalhe-crianca em vez de formulario-crianca).
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
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
