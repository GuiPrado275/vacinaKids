import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../../core/service/auth.service';

// Protege as rotas que só fazem sentido com alguém logado (lista de
// crianças, detalhe, cadastro). Sem isso, digitar a URL direto na barra
// do navegador (ou um link salvo) abriria a tela mesmo sem sessão ativa.
//
// Função simples (não classe) porque é assim que o Angular standalone
// espera um guard moderno — registrado direto em app.routes.ts com
// `canActivate: [authGuard]`, sem precisar de um NgModule só pra isso.
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.estaLogado()) {
    return true;
  }

  // Redireciona pro login em vez de simplesmente bloquear — a pessoa
  // ainda consegue chegar onde queria ir, só precisa entrar antes.
  return router.createUrlTree(['/login']);
};
