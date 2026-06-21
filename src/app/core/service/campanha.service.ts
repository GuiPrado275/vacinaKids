import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, addDoc, updateDoc, deleteDoc, getDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Campanha, CampanhaForm, campanhaEstaAtiva } from '../model/campanha.model';

const NOME_COLECAO = 'campanhas';

// Campanha é informação pública, não pertence a uma criança específica
// (igual já está explicado no model Campanha.ts). Por isso esse service
// é mais simples: não precisa filtrar por responsável nem cruzar com
// registro vacinal.
//
// MIGRAÇÃO PRA FIREBASE: leitura é liberada pra qualquer pessoa
// autenticada (ver firestore.rules) — todo responsável pode VER as
// campanhas. Escrita (criar/editar/remover) é restrita a isAdmin == true
// nas regras, então mesmo que alguém manipule o front-end pra esconder o
// FAB de admin, o Firestore recusaria a escrita de qualquer forma.
@Injectable({ providedIn: 'root' })
export class CampanhaService {
  private readonly firestore = inject(Firestore);
  private readonly colecaoRef = collection(this.firestore, NOME_COLECAO);

  listar(): Observable<Campanha[]> {
    return collectionData(this.colecaoRef, { idField: 'id' }) as Observable<Campanha[]>;
  }

  // Atende ao Cenário 3 do desafio: o responsável precisa ver as
  // campanhas que estão rolando hoje, não as que já passaram ou que
  // ainda vão começar (usa campanhaEstaAtiva, que já existe no model).
  listarAtivas(): Observable<Campanha[]> {
    return this.listar().pipe(map((campanhas) => campanhas.filter((campanha) => campanhaEstaAtiva(campanha))));
  }

  async buscarPorId(id: string): Promise<Campanha | undefined> {
    const ref = doc(this.firestore, NOME_COLECAO, id);
    const snapshot = await getDoc(ref);
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Campanha) : undefined;
  }

  async cadastrar(dados: CampanhaForm): Promise<Campanha> {
    const refCriada = await addDoc(this.colecaoRef, dados);
    return { id: refCriada.id, ...dados };
  }

  async atualizar(id: string, dados: Partial<CampanhaForm>): Promise<void> {
    const ref = doc(this.firestore, NOME_COLECAO, id);
    await updateDoc(ref, { ...dados });
  }

  async remover(id: string): Promise<void> {
    const ref = doc(this.firestore, NOME_COLECAO, id);
    await deleteDoc(ref);
  }
}
