import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { Vacina } from '../model/vacina.model';

// Catálogo de vacinas baseado no PNI (Programa Nacional de Imunizações),
// simplificado pro escopo do desafio. É a mesma lista pra todas as crianças
// (igual já está explicado no model Vacina.ts), por isso esse service só
// tem leitura — não existe "cadastrar vacina nova" aqui.
//
// MIGRAÇÃO PRA FIREBASE: de propósito esse catálogo NÃO foi movido pro
// Firestore. É dado estático, igual pra every criança, que não muda em
// runtime nem depende de quem está logado — não tem ganho nenhum em
// pagar uma consulta de rede pra isso toda vez que o app abre. Os outros
// services (responsaveis, criancas, registrosVacinais, campanhas) viraram
// coleções porque são dados que mudam e pertencem a alguém; este aqui
// continua sendo só uma constante do código.
@Injectable({ providedIn: 'root' })
export class VacinaService {
  private readonly vacinas$$ = new BehaviorSubject<Vacina[]>([
    { id: 'bcg', nome: 'BCG', doseNumero: 1, idadeRecomendadaMeses: 0, protegeContra: 'Tuberculose' },
    { id: 'hepb-1', nome: 'Hepatite B', doseNumero: 1, idadeRecomendadaMeses: 0, protegeContra: 'Hepatite B' },

    { id: 'penta-1', nome: 'Pentavalente', doseNumero: 1, idadeRecomendadaMeses: 2, protegeContra: 'Difteria, tétano, pertussis, hepatite B e Hib' },
    { id: 'vip-1', nome: 'VIP (Poliomielite inativada)', doseNumero: 1, idadeRecomendadaMeses: 2, protegeContra: 'Poliomielite' },
    { id: 'pneumo-1', nome: 'Pneumocócica 10V', doseNumero: 1, idadeRecomendadaMeses: 2, protegeContra: 'Pneumonia, otite e meningite pneumocócica' },
    { id: 'rota-1', nome: 'Rotavírus', doseNumero: 1, idadeRecomendadaMeses: 2, protegeContra: 'Diarreia por rotavírus' },

    { id: 'meningo-1', nome: 'Meningocócica C', doseNumero: 1, idadeRecomendadaMeses: 3, protegeContra: 'Meningite C' },

    { id: 'penta-2', nome: 'Pentavalente', doseNumero: 2, idadeRecomendadaMeses: 4, protegeContra: 'Difteria, tétano, pertussis, hepatite B e Hib' },
    { id: 'vip-2', nome: 'VIP (Poliomielite inativada)', doseNumero: 2, idadeRecomendadaMeses: 4, protegeContra: 'Poliomielite' },
    { id: 'pneumo-2', nome: 'Pneumocócica 10V', doseNumero: 2, idadeRecomendadaMeses: 4, protegeContra: 'Pneumonia, otite e meningite pneumocócica' },
    { id: 'rota-2', nome: 'Rotavírus', doseNumero: 2, idadeRecomendadaMeses: 4, protegeContra: 'Diarreia por rotavírus' },

    { id: 'meningo-2', nome: 'Meningocócica C', doseNumero: 2, idadeRecomendadaMeses: 5, protegeContra: 'Meningite C' },

    { id: 'penta-3', nome: 'Pentavalente', doseNumero: 3, idadeRecomendadaMeses: 6, protegeContra: 'Difteria, tétano, pertussis, hepatite B e Hib' },
    { id: 'vip-3', nome: 'VIP (Poliomielite inativada)', doseNumero: 3, idadeRecomendadaMeses: 6, protegeContra: 'Poliomielite' },

    { id: 'febre-amarela', nome: 'Febre Amarela', doseNumero: 1, idadeRecomendadaMeses: 9, protegeContra: 'Febre amarela' },

    { id: 'triplice-viral-1', nome: 'Tríplice Viral', doseNumero: 1, idadeRecomendadaMeses: 12, protegeContra: 'Sarampo, caxumba e rubéola' },
    { id: 'pneumo-reforco', nome: 'Pneumocócica 10V', doseNumero: 3, idadeRecomendadaMeses: 12, protegeContra: 'Pneumonia, otite e meningite pneumocócica', observacoes: 'Dose de reforço' },
    { id: 'meningo-reforco', nome: 'Meningocócica C', doseNumero: 3, idadeRecomendadaMeses: 12, protegeContra: 'Meningite C', observacoes: 'Dose de reforço' },

    { id: 'tetra-viral', nome: 'Tetra Viral', doseNumero: 1, idadeRecomendadaMeses: 15, protegeContra: 'Sarampo, caxumba, rubéola e varicela' },
    { id: 'dtp-reforco-1', nome: 'DTP', doseNumero: 1, idadeRecomendadaMeses: 15, protegeContra: 'Difteria, tétano e pertussis', observacoes: '1º reforço' },
    { id: 'hepatite-a', nome: 'Hepatite A', doseNumero: 1, idadeRecomendadaMeses: 15, protegeContra: 'Hepatite A' },

    { id: 'dtp-reforco-2', nome: 'DTP', doseNumero: 2, idadeRecomendadaMeses: 48, protegeContra: 'Difteria, tétano e pertussis', observacoes: '2º reforço' },
    { id: 'triplice-viral-2', nome: 'Tríplice Viral', doseNumero: 2, idadeRecomendadaMeses: 48, protegeContra: 'Sarampo, caxumba e rubéola', observacoes: '2ª dose' },
  ]);

  // Observable: quem assina recebe a lista e seria avisado automaticamente
  // se ela mudasse. Na prática esse catálogo não muda em tempo de execução,
  // mas mantemos o mesmo "formato" dos outros services pra ficar consistente.
  listar(): Observable<Vacina[]> {
    return this.vacinas$$.asObservable();
  }

  // Versão sem Observable, pra usar dentro de outros services que precisam
  // montar contas na hora (ex.: gerar o calendário de vacinas de uma criança).
  listarSincrono(): Vacina[] {
    return this.vacinas$$.value;
  }

  buscarPorId(id: string): Vacina | undefined {
    return this.vacinas$$.value.find((vacina) => vacina.id === id);
  }
}
