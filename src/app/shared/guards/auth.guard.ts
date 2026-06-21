import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';

import { AuthService } from '../../core/service/auth.service';

// Protege as rotas que só fazem sentido com alguém logado (lista de
// crianças, detalhe, campanhas, minha conta). Sem isso, digitar a URL
// direto na barra do navegador (ou abrir um link salvo) abriria a tela
// mesmo sem sessão ativa.
//
// MIGRAÇÃO PRA FIREBASE — por que isso é assíncrono agora: o Firebase
// Auth precisa de um instante pra checar se existe uma sessão válida na
// inicialização do SDK. Se o guard checasse de forma síncrona logo de
// cara, corre o risco de ver "ninguém logado" só porque o Firebase ainda
// não terminou de resolver — e mandar pro /login uma pessoa que na
// verdade JÁ está logada (um "flash" incorreto ao recarregar a página).
// `sessao$` (ver AuthService) só emite depois que usuário do Auth e
// perfil do Firestore estão sincronizados, então esperamos a primeira
// emissão antes de decidir.
//
// Função simples (não classe) porque é assim que o Angular standalone
// espera um guard moderno — registrado direto em app.routes.ts com
// `canActivate: [authGuard]`, sem precisar de um NgModule só pra isso.
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.sessao$.pipe(
    take(1),
    map(({ usuario }) => {
      if (usuario) {
        return true;
      }
      // Redireciona pro login em vez de simplesmente bloquear — a pessoa
      // ainda consegue chegar onde queria ir, só precisa entrar antes.
      return router.createUrlTree(['/login']);
    })
  );
};
