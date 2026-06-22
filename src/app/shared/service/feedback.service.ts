import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline, checkmarkCircleOutline } from 'ionicons/icons';

// Centraliza o aviso rápido (toast) pra ações que não têm um formulário
// próprio onde mostrar erro inline
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
