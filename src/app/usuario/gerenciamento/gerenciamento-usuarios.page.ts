import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { switchMap, from } from 'rxjs';
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

import { ResponsavelService } from '../../core/service/responsavel.service';
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

  // MIGRAÇÃO PRA FIREBASE: contarPorResponsavel agora é assíncrono
  // (Promise, uma consulta real ao Firestore), então não dá mais pra
  // chamar direto dentro de um .map() síncrono — usamos switchMap pra
  // trocar pro resultado da Promise.all assim que a lista de
  // responsáveis chegar (ou mudar, já que collectionData é em tempo real).
  protected readonly usuariosOrdenados$ = this.responsavelService.listar().pipe(
    switchMap((responsaveis) => {
      const naoAdmins = responsaveis.filter((responsavel) => !responsavel.isAdmin);

      const comContagem = Promise.all(
        naoAdmins.map(
          async (responsavel): Promise<UsuarioComContagem> => ({
            responsavel,
            totalCriancas: await this.criancaService.contarPorResponsavel(responsavel.id),
          })
        )
      ).then((lista) => lista.sort((a, b) => a.responsavel.nome.localeCompare(b.responsavel.nome)));

      return from(comContagem);
    })
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
  // deixar crianças órfãs penduradas no Firestore.
  //
  // Limitação conhecida: isso remove o PERFIL (Firestore), não a CONTA de
  // login (Firebase Auth) — o SDK do navegador só permite que uma conta
  // se delete a si mesma, nunca a de outra pessoa (isso exigiria o Admin
  // SDK rodando num backend, ex. Cloud Functions). Na prática a conta
  // continua "existindo" no Authentication mas vira inutilizável: sem
  // documento de perfil, as regras de segurança do Firestore bloqueiam
  // qualquer leitura/escrita pra esse usuário, então ele não consegue
  // mais usar o app mesmo que tente logar de novo.
  protected async aoFecharConfirmacaoRemover(evento: CustomEvent): Promise<void> {
    const role = evento.detail?.role;
    const responsavel = this.usuarioParaRemover;

    this.usuarioParaRemover = null;

    if (role !== 'confirm' || !responsavel) {
      return;
    }

    try {
      await this.criancaService.removerPorResponsavel(responsavel.id);
      await this.responsavelService.remover(responsavel.id);
    } catch (e) {
      this.erro = e instanceof Error ? e.message : 'Não foi possível remover esse usuário.';
    }
  }
}
