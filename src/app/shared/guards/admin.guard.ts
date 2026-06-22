import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';

import { AuthService } from '../../core/service/auth.service';

// Protege as rotas que só fazem sentido pro administrador (criar/editar
// campanha, gerenciar usuários).
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.sessao$.pipe(
    take(1),
    map(({ usuario, responsavel }) => {
      if (!usuario) {
        return router.createUrlTree(['/login']);
      }

      if (responsavel?.isAdmin === true) {
        return true;
      }

      return router.createUrlTree(['/criancas']);
    })
  );
};
