import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonBackButton, IonButtons } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { megaphoneOutline, calendarClearOutline } from 'ionicons/icons';

import { CampanhaService } from '../core/service/campanha.service';
import { campanhaEstaAtiva } from '../core/model/campanha.model';

// Tela dedicada às campanhas (Cenário 3), separada do hub principal.
// A lista de crianças já mostra um resumo das campanhas ativas, mas aqui
// é o lugar de ver todas elas — inclusive as que ainda vão começar — sem
// competir por espaço com os cards de criança.
@Component({
  selector: 'app-campanhas',
  standalone: true,
  templateUrl: './campanhas.page.html',
  styleUrls: ['./campanhas.page.scss'],
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonBackButton, IonButtons],
})
export class CampanhasPage {
  private readonly campanhaService = inject(CampanhaService);

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

  constructor() {
    addIcons({ megaphoneOutline, calendarClearOutline });
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
}
