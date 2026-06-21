// Funções de CPF usadas tanto pelo Responsavel (login) quanto pela
// Crianca (cadastro pra vacinação) — ficam juntas aqui porque a regra de
// validação é exatamente a mesma pros dois, não tem sentido duplicar.

// Remove ponto, traço e espaço, deixando só os números. É assim que o CPF
// fica guardado e é assim que ele deve ser comparado (login, checagem de
// duplicidade etc.) — não importa como a pessoa digitou.
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

  // CPFs com todos os dígitos iguais (111.111.111-11, 000.000.000-00...)
  // passariam na conta dos dígitos verificadores, mas nunca são CPFs
  // reais — por isso são rejeitados aqui antes de qualquer cálculo.
  if (/^(\d)\1{10}$/.test(numeros)) {
    return false;
  }

  const digitos = numeros.split('').map(Number);

  // Calcula um dígito verificador: soma cada um dos primeiros
  // "quantidadeDigitos" dígitos multiplicado por um peso decrescente,
  // depois tira o resto da divisão por 11. Usada duas vezes (uma pra
  // cada dígito verificador), só muda quantos dígitos entram na conta.
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

// O Firebase Authentication (modo Email/Password) exige um e-mail de
// verdade pra cada conta, mas a tela de login do app continua pedindo
// CPF — é a identidade que faz sentido pro responsável, não um e-mail
// que ele talvez nem tenha. Esse "e-mail sintético" existe só pra
// satisfazer o Firebase Auth por baixo dos panos; ele nunca aparece pra
// pessoa nem é usado pra mandar e-mail de verdade nenhum.
//
// Importante: isso é diferente do campo Responsavel.email (que é o
// e-mail real, opcional, editável em "Minha conta") — os dois nunca se
// misturam.
const DOMINIO_EMAIL_SINTETICO = 'carteirinha.app';

export function cpfParaEmailSintetico(cpf: string): string {
  return `${normalizarCpf(cpf)}@${DOMINIO_EMAIL_SINTETICO}`;
}
