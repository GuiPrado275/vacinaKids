import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, combineLatest, map, switchMap } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonFab,
  IonFabButton,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logOutOutline, addOutline, megaphoneOutline, alertCircleOutline, chevronForwardOutline } from 'ionicons/icons';

import { AuthService } from '../../core/service/auth.service';
import { CriancaService } from '../../core/service/crianca.service';
import { CampanhaService } from '../../core/service/campanha.service';
import { RegistroVacinalService, ResumoVacinal } from '../../core/service/registro-vacinal.service';
import { Crianca } from '../../core/model/crianca.model';
import { calcularIdadeEmMeses } from '../../core/model/crianca.model';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { StatusVacina } from '../../core/model/enum/status-vacina.enum';

// Card de criança já com tudo que a tela precisa pra renderizar — montado
// uma vez no componente, em vez de cada item do template ficar chamando
// services soltos dentro de pipes async aninhados (o que criaria uma
// subscription nova por mudança de detecção e seria difícil de ler).
interface CriancaComResumo {
  crianca: Crianca;
  idadeEmMeses: number;
  resumo: ResumoVacinal;
  temPendencia: boolean;
}

@Component({
  selector: 'app-lista-criancas',
  standalone: true,
  templateUrl: './lista-criancas.page.html',
  styleUrls: ['./lista-criancas.page.scss'],
  imports: [
    CommonModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonFab,
    IonFabButton,
    StatusBadgeComponent,
  ],
})
export class ListaCriancasPage {
  private readonly authService = inject(AuthService);
  private readonly criancaService = inject(CriancaService);
  private readonly campanhaService = inject(CampanhaService);
  private readonly registroVacinalService = inject(RegistroVacinalService);

  protected readonly StatusVacina = StatusVacina;

  protected readonly nomeResponsavel$ = this.authService
    .responsavelLogado()
    .pipe(map((responsavel) => responsavel?.nome?.split(' ')[0] ?? ''));

  // Cenário 3 do desafio: campanhas ativas precisam aparecer pro
  // responsável dentro do app — aqui na tela principal, onde toda criança
  // já está visível, é o lugar mais natural de mostrar isso, sem precisar
  // de uma aba própria só pra uma ou duas campanhas.
  protected readonly campanhasAtivas$ = this.campanhaService.listarAtivas();

  // Para cada criança da conta, busca o resumo vacinal dela (Cenário 1) e
  // calcula se tem pendência (Cenário 2) — assim o card já nasce sabendo
  // se precisa mostrar o aviso de atraso, sem o template ter que decidir
  // isso sozinho.
  protected readonly criancas$: Observable<CriancaComResumo[]> = this.criancaService.listar().pipe(
    switchMap((criancas) => {
      if (criancas.length === 0) {
        return [[]] as unknown as Observable<CriancaComResumo[]>;
      }

      const comResumo$ = criancas.map((crianca) =>
        this.registroVacinalService.obterResumo(crianca.id).pipe(
          map((resumo) => ({
            crianca,
            idadeEmMeses: calcularIdadeEmMeses(crianca.dataNascimento),
            resumo,
            temPendencia: resumo.atrasadas > 0,
          }))
        )
      );

      return combineLatest(comResumo$);
    })
  );

  constructor() {
    addIcons({ logOutOutline, addOutline, megaphoneOutline, alertCircleOutline, chevronForwardOutline });
  }

  protected sair(): void {
    this.authService.logout();
  }

  // Texto curto de idade ("3 meses" / "2 anos e 3 meses") em vez de só o
  // número de meses cru — é o tipo de decisão de UX que o desafio pede
  // explicitamente pra facilitar a leitura de quem está olhando o app.
  protected formatarIdade(meses: number): string {
    if (meses < 24) {
      return meses === 1 ? '1 mês' : `${meses} meses`;
    }
    const anos = Math.floor(meses / 12);
    const mesesRestantes = meses % 12;
    const textoAnos = anos === 1 ? '1 ano' : `${anos} anos`;
    if (mesesRestantes === 0) {
      return textoAnos;
    }
    return `${textoAnos} e ${mesesRestantes} ${mesesRestantes === 1 ? 'mês' : 'meses'}`;
  }
}
