import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonIcon,
  IonAlert,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { peopleOutline, trashOutline } from 'ionicons/icons';

import ResponsavelService from '../../core/service/responsavel.service';
import { CriancaService } from '../../core/service/crianca.service';
import { formatarCpf } from '../../core/util/cpf.util';
import { Responsavel } from '../../core/model/responsavel.model';

interface UsuarioComContagem {
  responsavel: Responsavel;
  totalCriancas: number;
}

// Tela só do admin (rota protegida por adminGuard). Mostra todos os
// responsáveis cadastrados no app — nome, CPF e quantas crianças cada um
// tem — com opção de remover qualquer um deles. A própria conta admin
// nunca aparece aqui (ver `usuariosOrdenados$`): gerenciar a própria
// conta é coisa da tela "Minha conta" (EditarUsuarioPage), não desta.
@Component({
  selector: 'app-gerenciamento-usuarios',
  standalone: true,
  templateUrl: './gerenciamento-usuarios.page.html',
  styleUrls: ['./gerenciamento-usuarios.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonIcon,
    IonAlert,
  ],
})
export class GerenciamentoUsuariosPage {
  private readonly responsavelService = inject(ResponsavelService);
  private readonly criancaService = inject(CriancaService);

  protected readonly usuariosOrdenados$ = this.responsavelService.listar().pipe(
    map((responsaveis) =>
      responsaveis
        .filter((responsavel) => !responsavel.isAdmin)
        .map(
          (responsavel): UsuarioComContagem => ({
            responsavel,
            totalCriancas: this.criancaService.contarPorResponsavel(responsavel.id),
          })
        )
        .sort((a, b) => a.responsavel.nome.localeCompare(b.responsavel.nome))
    )
  );

  protected usuarioParaRemover: Responsavel | null = null;
  protected erro: string | null = null;

  constructor() {
    addIcons({ peopleOutline, trashOutline });
  }

  protected formatarCpfExibicao(cpf: string): string {
    return formatarCpf(cpf);
  }

  protected pedirConfirmacaoRemover(responsavel: Responsavel): void {
    this.erro = null;
    this.usuarioParaRemover = responsavel;
  }

  // Remove o usuário e, junto, todas as crianças dele (mesma regra
  // aplicada na auto-exclusão em EditarUsuarioPage, via
  // CriancaService.removerPorResponsavel) — um usuário removido não pode
  // deixar crianças órfãs penduradas no storage.
  protected aoFecharConfirmacaoRemover(evento: CustomEvent): void {
    const role = evento.detail?.role;
    const responsavel = this.usuarioParaRemover;

    this.usuarioParaRemover = null;

    if (role !== 'confirm' || !responsavel) {
      return;
    }

    try {
      this.criancaService.removerPorResponsavel(responsavel.id);
      this.responsavelService.remover(responsavel.id);
    } catch (e) {
      this.erro = e instanceof Error ? e.message : 'Não foi possível remover esse usuário.';
    }
  }
}
