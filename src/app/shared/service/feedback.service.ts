import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline, checkmarkCircleOutline } from 'ionicons/icons';

// Centraliza o aviso rápido (toast) pra ações que não têm um formulário
// próprio onde mostrar erro inline (ex.: marcar/desfazer vacina aplicada,
// remover campanha) — fluxos de "confirmar e executar" disparados a
// partir de um ion-alert, sem campo de tela dedicado pra mensagem.
//
// Existe pra não deixar nenhuma ação assíncrona falhar em silêncio: sem
// isso, um erro de rede ou de permissão nesses pontos simplesmente não
// avisava a pessoa de nada — ela via a tela "não fazer nada" e não saberia
// se precisa tentar de novo ou se já deu certo.
//
// Os ícones usados pelo toast são registrados aqui mesmo (não em cada
// página que injeta o service) — assim o aviso aparece com o ícone certo
// independente de qual tela chamou primeiro, sem depender de outra
// página já ter feito esse addIcons antes.
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly toastController = inject(ToastController);

  constructor() {
    addIcons({ alertCircleOutline, checkmarkCircleOutline });
  }

  async erro(mensagem: string): Promise<void> {
    const toast = await this.toastController.create({
      message: mensagem,
      duration: 3500,
      position: 'top',
      color: 'danger',
      icon: 'alert-circle-outline',
      buttons: [{ text: 'Fechar', role: 'cancel' }],
    });
    await toast.present();
  }

  async sucesso(mensagem: string): Promise<void> {
    const toast = await this.toastController.create({
      message: mensagem,
      duration: 2200,
      position: 'top',
      color: 'success',
      icon: 'checkmark-circle-outline',
    });
    await toast.present();
  }
}
