import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonInput,
  IonButton,
  IonText,
  IonItem,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { medkitOutline, eyeOutline, eyeOffOutline, personCircleOutline } from 'ionicons/icons';

import { AuthService } from '../../core/service/auth.service';
import { normalizarCpf, formatarCpf } from '../../core/util/cpf.util';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IonContent, IonIcon, IonInput, IonButton, IonText, IonItem],
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = this.fb.nonNullable.group({
    cpf: ['', [Validators.required]],
    senha: ['', [Validators.required]],
  });

  protected senhaVisivel = false;
  protected erroLogin: string | null = null;
  protected enviando = false;

  // Mensagem de boas-vindas depois de um cadastro recém-feito (ver CadastroPage.cadastrar, que redireciona pra cá
  // com ?cadastrado=1 em vez de logar automaticamente).
  protected readonly cadastroRecente = this.route.snapshot.queryParamMap.get('cadastrado') === '1';

  constructor() {
    addIcons({ medkitOutline, eyeOutline, eyeOffOutline, personCircleOutline });
  }

  // Formata o CPF visualmente enquanto a pessoa digita (000.000.000-00), mas quem decide se está válido de verdade é
  // sempre o normalizarCpf no momento do submit
  protected aoDigitarCpf(valor: string): void {
    const numeros = normalizarCpf(valor).slice(0, 11);
    const formatado = numeros.length === 11 ? formatarCpf(numeros) : numeros;
    this.form.controls.cpf.setValue(formatado, { emitEvent: false });
  }

  protected alternarVisibilidadeSenha(): void {
    this.senhaVisivel = !this.senhaVisivel;
  }

  protected async entrar(): Promise<void> {
    this.erroLogin = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando = true;
    const { cpf, senha } = this.form.getRawValue();

    // O AuthService já faz a comparação contra o Firebase Auth e lança erro com mensagem amigável em caso de falha
    // (CPF não encontrado OU senha errada)
    try {
      await this.authService.login(cpf, senha);
      this.router.navigateByUrl('/criancas', { replaceUrl: true });
    } catch (erro) {
      this.erroLogin = erro instanceof Error ? erro.message : 'CPF ou senha inválidos.';
    } finally {
      this.enviando = false;
    }
  }
}
