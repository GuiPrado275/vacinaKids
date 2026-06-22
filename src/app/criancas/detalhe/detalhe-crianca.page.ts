import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, map, switchMap, of, combineLatest } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonIcon,
  IonButton,
  IonAlert,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkOutline, arrowUndoOutline, calendarOutline, lockClosedOutline, alertCircle, checkmarkCircle, searchOutline, giftOutline } from 'ionicons/icons';

import { CriancaService } from '../../core/service/crianca.service';
import { RegistroVacinalService, RegistroDetalhado, ResumoVacinal } from '../../core/service/registro-vacinal.service';
import { Crianca, calcularIdadeEmMeses } from '../../core/model/crianca.model';
import { StatusVacina } from '../../core/model/enum/status-vacina.enum';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { FeedbackService } from '../../shared/service/feedback.service';

// Uma "faixa etária" da carteira, com as vacinas previstas pra essa idade já agrupadas
interface GrupoIdade {
  idadeRecomendadaMeses: number;
  rotulo: string;
  registros: RegistroDetalhado[];
}

interface DetalheCrianca {
  crianca: Crianca;
  idadeEmMeses: number;
  resumo: ResumoVacinal;
  grupos: GrupoIdade[];
}

@Component({
  selector: 'app-detalhe-crianca',
  standalone: true,
  templateUrl: './detalhe-crianca.page.html',
  styleUrls: ['./detalhe-crianca.page.scss'],
  imports: [
    CommonModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonIcon,
    IonButton,
    IonAlert,
    StatusBadgeComponent,
  ],
})
export class DetalheCriancaPage {
  private readonly route = inject(ActivatedRoute);
  private readonly criancaService = inject(CriancaService);
  private readonly registroVacinalService = inject(RegistroVacinalService);
  private readonly feedbackService = inject(FeedbackService);

  protected readonly StatusVacina = StatusVacina;
  protected registroParaConfirmar: RegistroDetalhado | null = null;

  protected readonly detalhe$: Observable<DetalheCrianca | null> = this.route.paramMap.pipe(
    map((params) => params.get('id')),
    switchMap((id) => {
      if (!id) return of(null);

      return combineLatest([
        this.criancaService.buscarPorIdObservable(id),
        this.registroVacinalService.listarDetalhadoPorCrianca(id),
      ]).pipe(
        map(([crianca, registros]) => {
          if (!crianca) return null;
          return {
            crianca,
            idadeEmMeses: calcularIdadeEmMeses(crianca.dataNascimento),
            resumo: this.calcularResumo(registros),
            grupos: this.agruparPorIdade(registros),
          };
        })
      );
    })
  );

  constructor() {
    addIcons({ checkmarkOutline, arrowUndoOutline, calendarOutline, lockClosedOutline, alertCircle, checkmarkCircle, searchOutline, giftOutline });
  }

  // Rótulo amigável da faixa etária — "Ao nascer", "2 meses", "4 anos"
  private rotularIdade(meses: number): string {
    if (meses === 0) return 'Ao nascer';
    if (meses < 24) return meses === 1 ? '1 mês' : `${meses} meses`;
    const anos = meses / 12;
    return Number.isInteger(anos) ? (anos === 1 ? '1 ano' : `${anos} anos`) : `${meses} meses`;
  }

  private agruparPorIdade(registros: RegistroDetalhado[]): GrupoIdade[] {
    const porIdade = new Map<number, RegistroDetalhado[]>();

    for (const registro of registros) {
      const idade = registro.vacina.idadeRecomendadaMeses;
      const grupo = porIdade.get(idade) ?? [];
      grupo.push(registro);
      porIdade.set(idade, grupo);
    }

    return Array.from(porIdade.entries())
      .sort(([a], [b]) => a - b)
      .map(([idadeRecomendadaMeses, registrosDoGrupo]) => ({
        idadeRecomendadaMeses,
        rotulo: this.rotularIdade(idadeRecomendadaMeses),
        registros: registrosDoGrupo,
      }));
  }

  private calcularResumo(registros: RegistroDetalhado[]): ResumoVacinal {
    return {
      total: registros.length,
      aplicadas: registros.filter((r) => r.status === StatusVacina.APLICADA).length,
      emDia: registros.filter((r) => r.status === StatusVacina.EM_DIA).length,
      atrasadas: registros.filter((r) => r.status === StatusVacina.ATRASADA).length,
      futuras: registros.filter((r) => r.status === StatusVacina.FUTURA).length,
    };
  }

  protected grupoConcluido(grupo: GrupoIdade): boolean {
    return grupo.registros.every((r) => r.status === StatusVacina.APLICADA);
  }

  // Pede confirmação antes de marcar como aplicada, porque é uma ação que afeta um registro de saúde,
  // não deve acontecer por toque acidental.
  protected pedirConfirmacaoAplicar(registro: RegistroDetalhado): void {
    if (registro.status === StatusVacina.FUTURA) {
      return;
    }
    this.registroParaConfirmar = registro;
  }

  // Único handler pro didDismiss do ion-alert: cobre tanto "Cancelar" quanto fechar clicando fora (backdrop)
  protected async aoFecharConfirmacao(evento: CustomEvent): Promise<void> {
    const role = evento.detail?.role;
    const registro = this.registroParaConfirmar;

    this.registroParaConfirmar = null;

    if (role === 'confirm' && registro) {
      const hoje = new Date().toISOString().slice(0, 10);
      try {
        await this.registroVacinalService.registrarAplicacao(registro.id, hoje);
        await this.feedbackService.sucesso(`${registro.vacina.nome} marcada como aplicada.`);
      } catch (erro) {
        await this.feedbackService.erro(
          erro instanceof Error ? erro.message : 'Não foi possível marcar essa vacina como aplicada.'
        );
      }
    }
  }

  protected async desfazerAplicacao(registro: RegistroDetalhado): Promise<void> {
    try {
      await this.registroVacinalService.desfazerAplicacao(registro.id);
      await this.feedbackService.sucesso(`Aplicação de ${registro.vacina.nome} desfeita.`);
    } catch (erro) {
      await this.feedbackService.erro(
        erro instanceof Error ? erro.message : 'Não foi possível desfazer essa aplicação.'
      );
    }
  }

  protected formatarData(data: string | null): string {
    if (!data) return '';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }
}
