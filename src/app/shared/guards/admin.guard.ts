import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';

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
//
// MIGRAÇÃO PRA FIREBASE: usa o mesmo `sessao$` do authGuard — que só
// emite depois que o usuário do Firebase Auth E o perfil correspondente
// no Firestore (de onde vem `isAdmin`) já estão sincronizados entre si.
// Isso evita o caso de barrar o próprio admin por engano só porque o
// documento do Firestore ainda não tinha chegado quando o guard rodou.
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
