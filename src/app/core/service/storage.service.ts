import { Injectable } from '@angular/core';

// Aqui concentramos toda a conversa com o localStorage do navegador.
// O desafio não pede um backend obrigatório, então usamos o armazenamento
// local pra simular um "banco de dados" e não perder os dados quando a
// página é recarregada.
//
// Decisão importante: nenhum outro service fala com o localStorage direto,
// todos passam por aqui. Assim, se um dia trocarmos isso por Firestore
// (um dos diferenciais do desafio), só essa classe precisa mudar — o resto
// do app continua chamando os mesmos métodos e nem fica sabendo da troca.
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
