import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../../core/service/auth.service';

// Protege as rotas que só fazem sentido pro administrador (criar/editar
// campanha, gerenciar usuários). Roda DEPOIS do authGuard nas rotas que
// precisam dos dois (a pessoa precisa estar logada E ser admin) — então
// se alguém não logado tentar acessar direto, ainda cai no /login normal,
// não num "acesso negado" sem contexto.
//
// Se a pessoa está logada mas não é admin, manda pra a tela inicial
// (/criancas) em vez de mostrar uma tela de erro — ela não fez nada de
// errado, só não tem permissão pra essa área específica.
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.estaLogado()) {
    return router.createUrlTree(['/login']);
  }

  if (authService.ehAdmin()) {
    return true;
  }

  return router.createUrlTree(['/criancas']);
};
