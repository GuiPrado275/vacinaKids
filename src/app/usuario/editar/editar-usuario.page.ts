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
  IonModal,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eyeOutline, eyeOffOutline, trashOutline } from 'ionicons/icons';

import { AuthService } from '../../core/service/auth.service';
import { ResponsavelService } from '../../core/service/responsavel.service';
import { CriancaService } from '../../core/service/crianca.service';
import { Responsavel } from '../../core/model/responsavel.model';

//Tela de "minha conta", disponível pra qualquer responsável logado (admin incluso). Só permite mexer em e-mail e senha,
// CPF não muda porque é a chave de login (mexer nele teria implicações maiores, tipo duas contas colidindo,
// e não foi pedido). A opção de excluir a conta fica aqui também, exceto pro admin (ver template e justificativa
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
    IonModal,
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
  // acontecer, a rota já tem authGuard)
  private readonly responsavel: Responsavel | null = this.authService.obterResponsavelLogado();

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.email]],
    novaSenha: ['', [Validators.minLength(6)]],
    confirmarNovaSenha: [''],
    senhaAtualParaSenha: [''],
  });

  // Formulário separado pra exclusão de conta
  protected readonly formExclusao = this.fb.nonNullable.group({
    senhaAtual: ['', [Validators.required]],
  });

  protected senhaVisivel = false;
  protected confirmarSenhaVisivel = false;
  protected senhaAtualVisivel = false;
  protected senhaExclusaoVisivel = false;
  protected erro: string | null = null;
  protected sucesso: string | null = null;
  protected enviando = false;
  protected confirmandoExclusao = false;
  protected excluindo = false;
  protected erroExclusao: string | null = null;

  constructor() {
    addIcons({ eyeOutline, eyeOffOutline, trashOutline });

    if (this.responsavel) {
      this.form.controls.email.setValue(this.responsavel.email ?? '');
    }
  }

  protected get nomeResponsavel(): string {
    return this.responsavel?.nome ?? '';
  }

  // Conta admin nunca pode se autoexcluir — sem isso, o app ficaria sem nenhuma forma de gerenciar campanhas/usuários
  // até alguém mexer diretamente no Firestore.
  protected get podeExcluirConta(): boolean {
    return this.responsavel?.isAdmin !== true;
  }

  protected get senhasNaoCoincidem(): boolean {
    const { novaSenha, confirmarNovaSenha } = this.form.getRawValue();
    return novaSenha.length > 0 && novaSenha !== confirmarNovaSenha;
  }

  protected async salvar(): Promise<void> {
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

    const { email, novaSenha, senhaAtualParaSenha } = this.form.getRawValue();

    if (novaSenha && !senhaAtualParaSenha) {
      this.erro = 'Informe sua senha atual para definir uma nova senha.';
      return;
    }

    this.enviando = true;
    try {
      if (novaSenha && senhaAtualParaSenha) {
        await this.authService.atualizarSenha(senhaAtualParaSenha, novaSenha);
      }

      await this.responsavelService.atualizar(this.responsavel.id, { email: email || undefined });

      this.form.controls.novaSenha.setValue('');
      this.form.controls.confirmarNovaSenha.setValue('');
      this.form.controls.senhaAtualParaSenha.setValue('');
      this.sucesso = 'Dados atualizados com sucesso.';
    } catch (e) {
      this.erro = e instanceof Error ? e.message : 'Não foi possível salvar as alterações.';
    } finally {
      this.enviando = false;
    }
  }

  protected pedirConfirmacaoExclusao(): void {
    this.erroExclusao = null;
    this.formExclusao.reset();
    this.confirmandoExclusao = true;
  }

  protected cancelarExclusao(): void {
    this.confirmandoExclusao = false;
  }

  // Exclui a conta e as crianças dela junto, orquestrado aqui (na tela), não dentro de um service chamando o outro,
  // pelo mesmo motivo já documentado em ResponsavelService.remover (evita dependência circular entre os services).
  protected async confirmarExclusao(): Promise<void> {
    this.erroExclusao = null;

    if (this.formExclusao.invalid || !this.responsavel) {
      this.formExclusao.markAllAsTouched();
      return;
    }

    const { senhaAtual } = this.formExclusao.getRawValue();
    const idResponsavel = this.responsavel.id;

    this.excluindo = true;
    try {
      await this.authService.confirmarSenhaAtual(senhaAtual);
      await this.criancaService.removerPorResponsavel(idResponsavel);
      await this.responsavelService.remover(idResponsavel);
      await this.authService.excluirConta();

      this.confirmandoExclusao = false;
      this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch (e) {
      this.erroExclusao = e instanceof Error ? e.message : 'Não foi possível excluir a conta.';
    } finally {
      this.excluindo = false;
    }
  }
}
