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

// Tela de "minha conta", disponível pra qualquer responsável logado
// (admin incluso). Só permite mexer em e-mail e senha — CPF não muda
// porque é a chave de login (mexer nele teria implicações maiores, tipo
// duas contas colidindo, e não foi pedido). A opção de excluir a conta
// fica aqui também, exceto pro admin (ver template e justificativa
// abaixo em `podeExcluirConta`).
//
// MIGRAÇÃO PRA FIREBASE: trocar senha e excluir a conta são operações
// "sensíveis" pro Firebase Auth — ele exige que a pessoa tenha feito
// login recentemente, e se não tiver, rejeita com
// 'auth/requires-recent-login'. Pra cobrir esse caso sem complicar demais
// a experiência, pedimos a SENHA ATUAL nessas duas ações específicas (não
// pra trocar só o e-mail de contato, que é um dado de perfil, não uma
// credencial).
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
  // acontecer, a rota já tem authGuard), a tela mostra estado vazio em
  // vez de quebrar.
  private readonly responsavel: Responsavel | null = this.authService.obterResponsavelLogado();

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.email]],
    novaSenha: ['', [Validators.minLength(6)]],
    confirmarNovaSenha: [''],
    // Só é exigida quando a pessoa de fato preenche novaSenha — ver
    // validação manual em salvar().
    senhaAtualParaSenha: [''],
  });

  // Formulário separado pra exclusão de conta: mantém a senha de
  // confirmação isolada do formulário principal, pra trocar só o e-mail
  // não ficar "contaminado" com um campo de senha que não tem nada a ver.
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

  // Conta admin nunca pode se autoexcluir — sem isso, o app ficaria sem
  // nenhuma forma de gerenciar campanhas/usuários até alguém mexer
  // diretamente no Firestore. A regra "de verdade" também existe no
  // ResponsavelService.remover (defesa em profundidade), aqui é só pra
  // nem mostrar o botão.
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
      // E-mail de contato (Firestore) e senha (Firebase Auth) são duas
      // operações em sistemas diferentes — ver comentários nos services.
      // Trocamos a senha PRIMEIRO (é a que pode falhar por senha atual
      // errada); só se ela passar é que gravamos o e-mail, evitando
      // salvar metade da edição se a outra metade falhar.
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

  // Exclui a conta E as crianças dela junto — orquestrado aqui (na tela),
  // não dentro de um service chamando o outro, pelo mesmo motivo já
  // documentado em ResponsavelService.remover (evita dependência
  // circular entre os services).
  //
  // Ordem em 3 passos, nessa ordem exata:
  //   1. confirmarSenhaAtual — só verifica a senha, não apaga nada ainda.
  //      Se a senha estiver errada, para aqui: nenhum dado é tocado.
  //   2. Apaga crianças + perfil no Firestore (a pessoa ainda está
  //      autenticada nesse momento, então as regras de segurança
  //      permitem ela apagar os PRÓPRIOS dados).
  //   3. excluirConta — por último, remove a credencial do Firebase Auth.
  // Se o passo 3 vier antes do 2, a pessoa perderia a autenticação e o
  // Firestore recusaria a limpeza dos próprios dados (regras de
  // segurança exigem estar logado pra apagar os próprios documentos).
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
