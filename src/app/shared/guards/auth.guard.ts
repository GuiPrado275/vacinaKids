import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';

import { AuthService } from '../../core/service/auth.service';

// Protege as rotas que só fazem sentido com alguém logado (lista de
// crianças, detalhe, campanhas, minha conta).
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.sessao$.pipe(
    take(1),
    map(({ usuario }) => {
      if (usuario) {
        return true;
      }
      // Redireciona pro login em vez de simplesmente bloquear
      return router.createUrlTree(['/login']);
    })
  );
};
