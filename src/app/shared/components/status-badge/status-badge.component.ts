import { Component, Input } from '@angular/core';
import { IonIcon, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircle, time, alertCircle, calendar } from 'ionicons/icons';

import { StatusVacina, STATUS_VACINA_CONFIG } from '../../../core/model/enum/status-vacina.enum';

// Único lugar do app que transforma um StatusVacina em algo visual.
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [IonIcon, IonBadge],
  template: `
    <ion-badge class="status-badge" [style.--badge-color]="config.cor" [style.color]="config.cor">
      <ion-icon [name]="config.icone" aria-hidden="true"></ion-icon>
      <span>{{ config.label }}</span>
    </ion-badge>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        background: color-mix(in srgb, var(--badge-color) 16%, white);
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.35rem 0.6rem;
        border-radius: 999px;
        text-transform: none;
      }

      ion-icon {
        font-size: 0.9rem;
      }
    `,
  ],
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: StatusVacina;

  constructor() {
    addIcons({ checkmarkCircle, time, alertCircle, calendar });
  }

  protected get config() {
    return STATUS_VACINA_CONFIG[this.status];
  }
}
