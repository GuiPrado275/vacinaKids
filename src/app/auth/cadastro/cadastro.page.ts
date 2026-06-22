import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonInput,
  IonButton,
  IonText,
  IonItem,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { medkitOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';

import { ResponsavelService } from '../../core/service/responsavel.service';
import { normalizarCpf, formatarCpf } from '../../core/util/cpf.util';

@Component({
  selector: 'app-cadastro',
  standalone: true,
  templateUrl: './cadastro.page.html',
  styleUrls: ['./cadastro.page.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IonContent, IonIcon, IonInput, IonButton, IonText, IonItem],
})
export class CadastroPage {
  private readonly fb = inject(FormBuilder);
  private readonly responsavelService = inject(ResponsavelService);
  private readonly router = inject(Router);

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(3)]],
    cpf: ['', [Validators.required]],
    email: ['', [Validators.email]],
    senha: ['', [Validators.required, Validators.minLength(6)]],
    confirmarSenha: ['', [Validators.required]],
  });

  protected senhaVisivel = false;
  protected confirmarSenhaVisivel = false;
  protected erroCadastro: string | null = null;
  protected enviando = false;

  constructor() {
    addIcons({ medkitOutline, eyeOutline, eyeOffOutline });
  }

  protected aoDigitarCpf(valor: string): void {
    const numeros = normalizarCpf(valor).slice(0, 11);
    const formatado = numeros.length === 11 ? formatarCpf(numeros) : numeros;
    this.form.controls.cpf.setValue(formatado, { emitEvent: false });
  }

  protected get senhasNaoCoincidem(): boolean {
    const { senha, confirmarSenha } = this.form.getRawValue();
    return confirmarSenha.length > 0 && senha !== confirmarSenha;
  }

  protected async cadastrar(): Promise<void> {
    this.erroCadastro = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.senhasNaoCoincidem) {
      this.erroCadastro = 'As senhas não coincidem.';
      return;
    }

    const { nome, cpf, email, senha } = this.form.getRawValue();
    const cpfNormalizado = normalizarCpf(cpf);

    if (cpfNormalizado.length !== 11) {
      this.erroCadastro = 'CPF inválido. Informe os 11 dígitos.';
      return;
    }

    this.enviando = true;

    try {
      await this.responsavelService.cadastrar({
        nome,
        cpf,
        email: email || undefined,
        senha,
      });

      // De propósito NÃO loga automaticamente após o cadastro, a pessoa precisa entrar com as credenciais que acabou
      // de criar, igual a maioria dos apps reais faz. O query param só liga a mensagem de boas-vindas na tela de login
      // (ver LoginPage.cadastroRecente).
      this.router.navigate(['/login'], { queryParams: { cadastrado: '1' }, replaceUrl: true });
    } catch (e: any) {
      this.erroCadastro = e.message ?? 'Erro ao cadastrar. Tente novamente.';
    } finally {
      this.enviando = false;
    }
  }
}
