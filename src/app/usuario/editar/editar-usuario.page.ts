import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonItem,
  IonInput,
  IonButton,
  IonText,
  IonAlert,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eyeOutline, eyeOffOutline, trashOutline } from 'ionicons/icons';

import { AuthService } from '../../core/service/auth.service';
import ResponsavelService from '../../core/service/responsavel.service';
import { CriancaService } from '../../core/service/crianca.service';
import { Responsavel } from '../../core/model/responsavel.model';

// Tela de "minha conta", disponível pra qualquer responsável logado
// (admin incluso). Só permite mexer em e-mail e senha — CPF não muda
// porque é a chave de login (mexer nele teria implicações maiores, tipo
// duas contas colidindo, e não foi pedido). A opção de excluir a conta
// fica aqui também, exceto pro admin (ver template e justificativa
// abaixo em `podeExcluirConta`).
@Component({
  selector: 'app-editar-usuario',
  standalone: true,
  templateUrl: './editar-usuario.page.html',
  styleUrls: ['./editar-usuario.page.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonItem,
    IonInput,
    IonButton,
    IonText,
    IonAlert,
    IonIcon,
  ],
})
export class EditarUsuarioPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly responsavelService = inject(ResponsavelService);
  private readonly criancaService = inject(CriancaService);
  private readonly router = inject(Router);

  // A conta logada agora — se por algum motivo não houver (não deveria
  // acontecer, a rota já tem authGuard), a tela mostra estado vazio em
  // vez de quebrar. Não é readonly porque salvar() precisa atualizar essa
  // referência local depois de editar e-mail/senha (ver `salvar`).
  private responsavel: Responsavel | null = this.authService.obterResponsavelLogado();

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.email]],
    novaSenha: ['', [Validators.minLength(6)]],
    confirmarNovaSenha: [''],
  });

  protected senhaVisivel = false;
  protected confirmarSenhaVisivel = false;
  protected erro: string | null = null;
  protected sucesso: string | null = null;
  protected enviando = false;
  protected confirmandoExclusao = false;

  constructor() {
    addIcons({ eyeOutline, eyeOffOutline, trashOutline });

    if (this.responsavel) {
      this.form.controls.email.setValue(this.responsavel.email ?? '');
    }
  }

  protected get nomeResponsavel(): string {
    return this.responsavel?.nome ?? '';
  }

  // Conta admin nunca pode se autoexcluir — sem isso, o app ficaria sem
  // nenhuma forma de gerenciar campanhas/usuários até alguém mexer no
  // storage manualmente. A regra "de verdade" também existe no
  // ResponsavelService.remover (defesa em profundidade), aqui é só pra
  // nem mostrar o botão.
  protected get podeExcluirConta(): boolean {
    return this.responsavel?.isAdmin !== true;
  }

  protected get senhasNaoCoincidem(): boolean {
    const { novaSenha, confirmarNovaSenha } = this.form.getRawValue();
    return novaSenha.length > 0 && novaSenha !== confirmarNovaSenha;
  }

  protected salvar(): void {
    this.erro = null;
    this.sucesso = null;

    if (!this.responsavel) {
      this.erro = 'Não foi possível identificar sua conta. Faça login novamente.';
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.senhasNaoCoincidem) {
      this.erro = 'As senhas não coincidem.';
      return;
    }

    const { email, novaSenha } = this.form.getRawValue();

    this.enviando = true;
    try {
      this.responsavelService.atualizar(this.responsavel.id, {
        email: email || undefined,
        ...(novaSenha ? { senha: novaSenha } : {}),
      });

      // Sem isso, o AuthService continuaria com a senha/e-mail antigos em
      // memória até a próxima vez que o app fosse recarregado (ver
      // comentário em AuthService.atualizarSessaoComDadosAtuais).
      this.authService.atualizarSessaoComDadosAtuais();
      this.responsavel = this.authService.obterResponsavelLogado();

      this.form.controls.novaSenha.setValue('');
      this.form.controls.confirmarNovaSenha.setValue('');
      this.sucesso = 'Dados atualizados com sucesso.';
    } catch (e) {
      this.erro = e instanceof Error ? e.message : 'Não foi possível salvar as alterações.';
    } finally {
      this.enviando = false;
    }
  }

  protected pedirConfirmacaoExclusao(): void {
    this.confirmandoExclusao = true;
  }

  // Exclui a conta E as crianças dela junto — orquestrado aqui (na tela),
  // não dentro de um service chamando o outro, pelo mesmo motivo já
  // documentado em ResponsavelService.remover (evita dependência
  // circular entre os services).
  protected aoFecharConfirmacaoExclusao(evento: CustomEvent): void {
    const role = evento.detail?.role;
    this.confirmandoExclusao = false;

    if (role !== 'confirm' || !this.responsavel) {
      return;
    }

    const idResponsavel = this.responsavel.id;

    try {
      this.criancaService.removerPorResponsavel(idResponsavel);
      this.responsavelService.remover(idResponsavel);
      this.authService.logout();
      this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch (e) {
      this.erro = e instanceof Error ? e.message : 'Não foi possível excluir a conta.';
    }
  }
}
