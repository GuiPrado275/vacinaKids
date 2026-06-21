import { Injectable } from '@angular/core';

// Camada de persistência local. Toda a leitura/escrita de dados passa por
// aqui — nenhum outro service acessa o localStorage diretamente.
//
// PREPARADO PARA FIRESTORE: quando for integrar o Firebase, basta substituir
// a implementação dos métodos abaixo pelas chamadas ao Firestore
// (collection / doc / setDoc / getDoc). A interface pública (obter / salvar
// / remover) não muda, então ResponsavelService, CriancaService e AuthService
// não precisam ser tocados. Os dados de cada coleção já usam chaves distintas
// (vacina_app_responsaveis, vacina_app_criancas, vacina_app_vacinas) que
// mapeiam diretamente para coleções do Firestore.
@Injectable({ providedIn: 'root' })
export class StorageService {
  // Busca um valor salvo. Devolve null se não existir ou se der algum erro
  // (ex.: navegador em modo privado bloqueando o storage).
  obter<T>(chave: string): T | null {
    try {
      const valorSalvo = localStorage.getItem(chave);
      return valorSalvo ? (JSON.parse(valorSalvo) as T) : null;
    } catch {
      return null;
    }
  }

  // Salva qualquer valor (objeto, array, etc.), convertendo pra texto antes.
  salvar<T>(chave: string, valor: T): void {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      // Se não conseguir salvar (storage cheio ou bloqueado), o app continua
      // funcionando normalmente em memória, só perde a persistência.
    }
  }

  remover(chave: string): void {
    try {
      localStorage.removeItem(chave);
    } catch {
      // Mesmo caso acima: não trava o app por causa disso.
    }
  }
}
