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
  IonSelect,
  IonSelectOption,
  IonDatetime,
  IonModal,
} from '@ionic/angular/standalone';

import { CriancaService } from '../../core/service/crianca.service';
import { normalizarCpf, formatarCpf, validarCpf } from '../../core/util/cpf.util';

@Component({
  selector: 'app-formulario-crianca',
  standalone: true,
  templateUrl: './formulario-crianca.page.html',
  styleUrls: ['./formulario-crianca.page.scss'],
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
    IonSelect,
    IonSelectOption,
    IonDatetime,
    IonModal,
  ],
})
export class FormularioCriancaPage {
  private readonly fb = inject(FormBuilder);
  private readonly criancaService = inject(CriancaService);
  private readonly router = inject(Router);

  // Hoje, formatado pra limitar o ion-datetime: não faz sentido cadastrar
  // uma criança com data de nascimento no futuro.
  protected readonly hojeIso = new Date().toISOString();

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(2)]],
    cpf: ['', [Validators.required]],
    dataNascimento: ['', [Validators.required]],
    sexo: ['NAO_INFORMADO' as 'F' | 'M' | 'NAO_INFORMADO'],
  });

  protected erroEnvio: string | null = null;
  protected enviando = false;

  protected aoDigitarCpf(valor: string): void {
    const numeros = normalizarCpf(valor).slice(0, 11);
    const formatado = numeros.length === 11 ? formatarCpf(numeros) : numeros;
    this.form.controls.cpf.setValue(formatado, { emitEvent: false });
  }

  // Validação de CPF de verdade (dígito verificador), além do required —
  // mostrar isso já no formulário evita que a pessoa só descubra o erro
  // depois de tentar salvar, no catch do cadastrar().
  protected get cpfInvalido(): boolean {
    const valor = this.form.controls.cpf.value;
    if (!valor) return false;
    return normalizarCpf(valor).length === 11 && !validarCpf(valor);
  }

  protected aoSelecionarData(valor: string | string[] | null | undefined): void {
    // ion-datetime sem `multiple` sempre emite string | null/undefined;
    // o array só existe no tipo porque o mesmo evento é reaproveitado
    // pro modo multi-seleção, que não usamos aqui — por isso o guard.
    if (!valor || Array.isArray(valor)) return;
    // ion-datetime devolve um ISO completo com horário; guardamos só a
    // parte de data (yyyy-MM-dd), que é o formato esperado por
    // Crianca.dataNascimento (ver core/model/crianca.model.ts).
    this.form.controls.dataNascimento.setValue(valor.slice(0, 10));
  }

  protected get dataNascimentoFormatada(): string {
    const valor = this.form.controls.dataNascimento.value;
    if (!valor) return '';
    const [ano, mes, dia] = valor.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  protected salvar(): void {
    this.erroEnvio = null;

    if (this.form.invalid || this.cpfInvalido) {
      this.form.markAllAsTouched();
      if (this.cpfInvalido) {
        this.erroEnvio = 'CPF inválido. Confira os números digitados.';
      }
      return;
    }

    this.enviando = true;
    const { nome, cpf, dataNascimento, sexo } = this.form.getRawValue();

    try {
      const crianca = this.criancaService.cadastrar({ nome, cpf, dataNascimento, sexo });
      this.router.navigate(['/criancas', crianca.id], { replaceUrl: true });
    } catch (erro) {
      // CriancaService já lança mensagens prontas pra exibir (CPF
      // duplicado, CPF inválido, não autenticado) — não precisamos
      // reescrever essas mensagens aqui, só repassar pro usuário.
      this.erroEnvio = erro instanceof Error ? erro.message : 'Não foi possível cadastrar a criança.';
    } finally {
      this.enviando = false;
    }
  }
}
