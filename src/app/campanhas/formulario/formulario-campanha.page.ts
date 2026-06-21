import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonItem,
  IonInput,
  IonTextarea,
  IonButton,
  IonText,
  IonDatetime,
  IonModal,
} from '@ionic/angular/standalone';

import { CampanhaService } from '../../core/service/campanha.service';

// Tela única pra criar OU editar campanha — só existe pro admin (rota
// protegida por adminGuard em app.routes.ts). Sem :id na rota, é
// cadastro; com :id, carrega a campanha existente e vira edição. Mesmo
// padrão do FormularioCriancaPage, adaptado pros campos de Campanha.
@Component({
  selector: 'app-formulario-campanha',
  standalone: true,
  templateUrl: './formulario-campanha.page.html',
  styleUrls: ['./formulario-campanha.page.scss'],
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
    IonTextarea,
    IonButton,
    IonText,
    IonDatetime,
    IonModal,
  ],
})
export class FormularioCampanhaPage {
  private readonly fb = inject(FormBuilder);
  private readonly campanhaService = inject(CampanhaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = this.fb.nonNullable.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    descricao: ['', [Validators.required, Validators.minLength(5)]],
    publicoAlvo: ['', [Validators.required]],
    dataInicio: ['', [Validators.required]],
    dataFim: ['', [Validators.required]],
  });

  protected erroEnvio: string | null = null;
  protected enviando = false;

  // Enquanto os dados da campanha existente ainda não chegaram do
  // Firestore (modo edição), o formulário fica desabilitado em vez de
  // mostrar campos vazios por um instante — ver template.
  protected carregando = false;

  // Se a rota tiver :id, estamos editando uma campanha existente — o
  // título da tela, o texto do botão e o salvar() todo se comportam
  // diferente dependendo desse valor.
  private readonly campanhaId: string | null = this.route.snapshot.paramMap.get('id');

  protected get editando(): boolean {
    return this.campanhaId !== null;
  }

  constructor() {
    if (this.campanhaId) {
      this.carregarCampanhaExistente(this.campanhaId);
    }
  }

  // MIGRAÇÃO PRA FIREBASE: buscarPorId agora é assíncrono (Promise), e um
  // construtor não pode ser async — por isso esse carregamento vira um
  // método à parte, chamado (sem await) no constructor. `carregando`
  // existe pra tela não mostrar um formulário vazio por engano enquanto
  // a campanha ainda está a caminho do Firestore.
  private async carregarCampanhaExistente(id: string): Promise<void> {
    this.carregando = true;
    try {
      const campanha = await this.campanhaService.buscarPorId(id);
      if (campanha) {
        this.form.setValue({
          titulo: campanha.titulo,
          descricao: campanha.descricao,
          publicoAlvo: campanha.publicoAlvo,
          dataInicio: campanha.dataInicio,
          dataFim: campanha.dataFim,
        });
      } else {
        this.erroEnvio = 'Campanha não encontrada.';
      }
    } finally {
      this.carregando = false;
    }
  }

  // Mesma ideia do FormularioCriancaPage: guarda só a parte de data
  // (yyyy-MM-dd) do que o ion-datetime devolve.
  protected aoSelecionarDataInicio(valor: string | string[] | null | undefined): void {
    if (!valor || Array.isArray(valor)) return;
    this.form.controls.dataInicio.setValue(valor.slice(0, 10));
  }

  protected aoSelecionarDataFim(valor: string | string[] | null | undefined): void {
    if (!valor || Array.isArray(valor)) return;
    this.form.controls.dataFim.setValue(valor.slice(0, 10));
  }

  protected formatarDataExibicao(valor: string): string {
    if (!valor) return '';
    const [ano, mes, dia] = valor.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  protected get dataInicioFormatada(): string {
    return this.formatarDataExibicao(this.form.controls.dataInicio.value);
  }

  protected get dataFimFormatada(): string {
    return this.formatarDataExibicao(this.form.controls.dataFim.value);
  }

  // Data fim não pode ser anterior à data início — só faz sentido validar
  // isso no submit, depois que as duas já foram escolhidas.
  protected get periodoInvalido(): boolean {
    const { dataInicio, dataFim } = this.form.getRawValue();
    if (!dataInicio || !dataFim) return false;
    return dataFim < dataInicio;
  }

  protected async salvar(): Promise<void> {
    this.erroEnvio = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.periodoInvalido) {
      this.erroEnvio = 'A data de término não pode ser anterior à data de início.';
      return;
    }

    this.enviando = true;
    const dados = this.form.getRawValue();

    try {
      if (this.campanhaId) {
        await this.campanhaService.atualizar(this.campanhaId, dados);
      } else {
        await this.campanhaService.cadastrar(dados);
      }
      this.router.navigateByUrl('/campanhas', { replaceUrl: true });
    } catch (erro) {
      this.erroEnvio = erro instanceof Error ? erro.message : 'Não foi possível salvar a campanha.';
    } finally {
      this.enviando = false;
    }
  }
}
