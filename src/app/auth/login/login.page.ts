import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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

// Tela de entrada do app. De propósito NÃO tem header (ion-header) — é a
// porta de entrada, antes de existir qualquer contexto de navegação por
// trás, então um toolbar com botão de voltar não faria sentido aqui.
@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [CommonModule, ReactiveFormsModule, IonContent, IonIcon, IonInput, IonButton, IonText, IonItem],
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Validação de formato fica no Validators.pattern (11 dígitos), a
  // validação "de verdade" (dígito verificador) só roda no submit, contra
  // o AuthService — não faz sentido duplicar a regra de validarCpf() aqui
  // só pra mostrar erro mais cedo; o "CPF ou senha inválidos" do submit
  // já cobre os dois casos (CPF malformado ou simplesmente não cadastrado).
  protected readonly form = this.fb.nonNullable.group({
    cpf: ['', [Validators.required]],
    senha: ['', [Validators.required]],
  });

  protected senhaVisivel = false;
  protected erroLogin: string | null = null;
  protected enviando = false;

  constructor() {
    addIcons({ medkitOutline, eyeOutline, eyeOffOutline, personCircleOutline });
  }

  // Formata o CPF visualmente enquanto a pessoa digita (000.000.000-00),
  // mas quem decide se está válido de verdade é sempre o normalizarCpf
  // no momento do submit — o que importa pro login é só a sequência de
  // números, nunca a pontuação.
  protected aoDigitarCpf(valor: string): void {
    const numeros = normalizarCpf(valor).slice(0, 11);
    const formatado = numeros.length === 11 ? formatarCpf(numeros) : numeros;
    this.form.controls.cpf.setValue(formatado, { emitEvent: false });
  }

  protected alternarVisibilidadeSenha(): void {
    this.senhaVisivel = !this.senhaVisivel;
  }

  protected entrar(): void {
    this.erroLogin = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando = true;
    const { cpf, senha } = this.form.getRawValue();

    // O AuthService já faz a comparação e devolve null em caso de falha
    // (CPF não encontrado OU senha errada) — de propósito não dizemos
    // qual dos dois foi, pra não dar pista de quais CPFs já têm conta.
    const responsavel = this.authService.login(cpf, senha);
    this.enviando = false;

    if (!responsavel) {
      this.erroLogin = 'CPF ou senha inválidos.';
      return;
    }

    this.router.navigateByUrl('/criancas', { replaceUrl: true });
  }

  protected preencherDemo(): void {
    this.form.setValue({ cpf: formatarCpf('12345678909'), senha: '123456' });
    this.erroLogin = null;
  }
}
