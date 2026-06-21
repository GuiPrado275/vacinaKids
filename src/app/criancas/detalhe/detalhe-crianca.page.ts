import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, map, switchMap, of } from 'rxjs';
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
import { checkmarkOutline, arrowUndoOutline, calendarOutline, lockClosedOutline } from 'ionicons/icons';

import { CriancaService } from '../../core/service/crianca.service';
import { RegistroVacinalService, RegistroDetalhado, ResumoVacinal } from '../../core/service/registro-vacinal.service';
import { Crianca, calcularIdadeEmMeses } from '../../core/model/crianca.model';
import { StatusVacina } from '../../core/model/enum/status-vacina.enum';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

// Uma "faixa etária" da carteira, com as vacinas previstas pra essa idade
// já agrupadas — é assim que a carteirinha física é organizada, e manter
// essa metáfora ajuda o responsável a reconhecer o app de cara.
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

  protected readonly StatusVacina = StatusVacina;
  protected registroParaConfirmar: RegistroDetalhado | null = null;

  protected readonly detalhe$: Observable<DetalheCrianca | null> = this.route.paramMap.pipe(
    map((params) => params.get('id')),
    switchMap((id) => {
      if (!id) return of(null);
      const crianca = this.criancaService.buscarPorId(id);
      if (!crianca) return of(null);

      return this.registroVacinalService.listarDetalhadoPorCrianca(id).pipe(
        map((registros) => ({
          crianca,
          idadeEmMeses: calcularIdadeEmMeses(crianca.dataNascimento),
          resumo: this.calcularResumo(registros),
          grupos: this.agruparPorIdade(registros),
        }))
      );
    })
  );

  constructor() {
    addIcons({ checkmarkOutline, arrowUndoOutline, calendarOutline, lockClosedOutline });
  }

  // Rótulo amigável da faixa etária — "Ao nascer", "2 meses", "4 anos" —
  // em vez de mostrar o número cru de meses, que é como o dado é
  // guardado mas não como uma pessoa pensa sobre a idade do próprio filho.
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

  // Pede confirmação antes de marcar como aplicada, porque é uma ação que
  // afeta um registro de saúde — não deve acontecer por toque acidental.
  //
  // Guarda extra contra vacina FUTURA: o botão já vem desabilitado nesse
  // caso (ver template), mas não confiamos só nisso — se por algum motivo
  // esse método for chamado mesmo assim, ele simplesmente não abre o
  // diálogo. Uma vacina prevista pra daqui a anos não pode ser marcada
  // como tomada fora de hora.
  protected pedirConfirmacaoAplicar(registro: RegistroDetalhado): void {
    if (registro.status === StatusVacina.FUTURA) {
      return;
    }
    this.registroParaConfirmar = registro;
  }

  // Único handler pro didDismiss do ion-alert: cobre tanto "Cancelar"
  // quanto fechar clicando fora (backdrop), que também dispara esse
  // evento com role indefinido — nesses casos só fechamos sem aplicar.
  protected aoFecharConfirmacao(evento: CustomEvent): void {
    const role = evento.detail?.role;
    const registro = this.registroParaConfirmar;

    this.registroParaConfirmar = null;

    if (role === 'confirm' && registro) {
      const hoje = new Date().toISOString().slice(0, 10);
      try {
        this.registroVacinalService.registrarAplicacao(registro.id, hoje);
      } catch {
        // Na prática não deve acontecer (o botão já vem desabilitado pra
        // vacina futura), mas se acontecer, simplesmente não aplica —
        // sem isso quebrar a tela.
      }
    }
  }

  protected desfazerAplicacao(registro: RegistroDetalhado): void {
    this.registroVacinalService.desfazerAplicacao(registro.id);
  }

  protected formatarData(data: string | null): string {
    if (!data) return '';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }
}
