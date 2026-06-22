export function normalizarCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

// Formata pra exibição: 52998224725 -> 529.982.247-25
export function formatarCpf(cpf: string): string {
  const numeros = normalizarCpf(cpf);
  if (numeros.length !== 11) {
    return cpf;
  }
  return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Validação oficial de CPF (cálculo dos dois dígitos verificadores), a
// mesma usada pela Receita Federal. Aceita o CPF com ou sem pontuação.
export function validarCpf(cpf: string): boolean {
  const numeros = normalizarCpf(cpf);

  if (numeros.length !== 11) {
    return false;
  }

  // CPFs com todos os dígitos iguais (111.111.111-11, 000.000.000-00...) passariam na conta dos dígitos verificadores,
  // mas nunca são CPFs reais, por isso são rejeitados aqui antes de qualquer cálculo.
  if (/^(\d)\1{10}$/.test(numeros)) {
    return false;
  }

  const digitos = numeros.split('').map(Number);

  const calcularDigitoVerificador = (quantidadeDigitos: number): number => {
    let soma = 0;
    for (let i = 0; i < quantidadeDigitos; i++) {
      soma += digitos[i] * (quantidadeDigitos + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const primeiroDigitoValido = calcularDigitoVerificador(9) === digitos[9];
  const segundoDigitoValido = calcularDigitoVerificador(10) === digitos[10];

  return primeiroDigitoValido && segundoDigitoValido;
}

const DOMINIO_EMAIL_SINTETICO = 'carteirinha.app';

export function cpfParaEmailSintetico(cpf: string): string {
  return `${normalizarCpf(cpf)}@${DOMINIO_EMAIL_SINTETICO}`;
}
