import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonBackButton,
  IonButtons,
  IonFab,
  IonFabButton,
  IonAlert,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { megaphoneOutline, calendarClearOutline, addOutline, closeOutline } from 'ionicons/icons';

import { CampanhaService } from '../core/service/campanha.service';
import { AuthService } from '../core/service/auth.service';
import { Campanha, campanhaEstaAtiva } from '../core/model/campanha.model';
import { FeedbackService } from '../shared/service/feedback.service';

// Tela dedicada às campanhas (Cenário 3), separada do hub principal.
// A lista de crianças já mostra um resumo das campanhas ativas, mas aqui
// é o lugar de ver todas elas — inclusive as que ainda vão começar — sem
// competir por espaço com os cards de criança.
//
// Pro admin, essa mesma tela também é onde ele gerencia as campanhas
// (criar, editar, remover) — de propósito sem mudar o layout do card pra
// quem não é admin, só adicionando os controles extras quando necessário.
@Component({
  selector: 'app-campanhas',
  standalone: true,
  templateUrl: './campanhas.page.html',
  styleUrls: ['./campanhas.page.scss'],
  imports: [
    CommonModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonBackButton,
    IonButtons,
    IonFab,
    IonFabButton,
    IonAlert,
  ],
})
export class CampanhasPage {
  private readonly campanhaService = inject(CampanhaService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly feedbackService = inject(FeedbackService);

  protected readonly campanhasOrdenadas$ = this.campanhaService.listar().pipe(
    map((campanhas) =>
      // Ativas primeiro (é a informação mais urgente pro responsável),
      // depois as demais ordenadas pela data de início.
      [...campanhas].sort((a, b) => {
        const ativaA = campanhaEstaAtiva(a);
        const ativaB = campanhaEstaAtiva(b);
        if (ativaA !== ativaB) return ativaA ? -1 : 1;
        return a.dataInicio.localeCompare(b.dataInicio);
      })
    )
  );

  // MIGRAÇÃO PRA FIREBASE: propriedade síncrona simples (pro template não
  // precisar de `| async` espalhado em vários lugares — class bindings,
  // atributos, clique), mas mantida sincronizada via subscribe ao
  // Observable de sessão. O authGuard já espera a sessão resolver antes
  // de liberar essa rota, então no momento em que o componente é criado
  // o valor inicial já reflete a sessão real — e continua acompanhando se
  // ela mudar enquanto a pessoa está na tela (ex.: logout em outra aba).
  protected ehAdmin = this.authService.ehAdmin();

  protected campanhaParaRemover: Campanha | null = null;

  constructor() {
    addIcons({ megaphoneOutline, calendarClearOutline, addOutline, closeOutline });
    this.authService.responsavelLogado().subscribe((responsavel) => {
      this.ehAdmin = responsavel?.isAdmin === true;
    });
  }

  protected estaAtiva(campanha: { dataInicio: string; dataFim: string }): boolean {
    return campanhaEstaAtiva(campanha);
  }

  protected formatarPeriodo(dataInicio: string, dataFim: string): string {
    const formatar = (data: string) => {
      const [ano, mes, dia] = data.split('-');
      return `${dia}/${mes}/${ano}`;
    };
    return `${formatar(dataInicio)} a ${formatar(dataFim)}`;
  }

  protected abrirEdicao(campanha: Campanha): void {
    this.router.navigate(['/campanhas', campanha.id, 'editar']);
  }

  // Recebe o evento do clique pra impedir que ele "borbulhe" pro card e
  // dispare abrirEdicao() junto — o botão de remover fica dentro do card
  // clicável, então sem isso, tocar em remover também abriria a edição.
  protected pedirConfirmacaoRemover(campanha: Campanha, evento: Event): void {
    evento.stopPropagation();
    this.campanhaParaRemover = campanha;
  }

  protected async aoFecharConfirmacaoRemover(evento: CustomEvent): Promise<void> {
    const role = evento.detail?.role;
    const campanha = this.campanhaParaRemover;

    this.campanhaParaRemover = null;

    if (role === 'confirm' && campanha) {
      try {
        await this.campanhaService.remover(campanha.id);
        await this.feedbackService.sucesso('Campanha removida.');
      } catch (erro) {
        // Antes essa chamada não tinha nenhum try/catch — uma falha de
        // rede ou de permissão virava um erro não tratado no console,
        // sem nenhum aviso na tela.
        await this.feedbackService.erro(
          erro instanceof Error ? erro.message : 'Não foi possível remover essa campanha.'
        );
      }
    }
  }
}
