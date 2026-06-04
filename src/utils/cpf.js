// Utilitário para tratamento de CPF (Cadastro de Pessoa Física).
// O CPF é um dado pessoal sensível: armazenamos sempre normalizado (apenas
// dígitos) e o mantemos fora das respostas da API (ver sanitize nos services).

// Remove qualquer caractere que não seja dígito (pontos, traços, espaços).
const normalizeCpf = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(/\D/g, '');
};

// Calcula um dígito verificador do CPF a partir dos primeiros `length` dígitos.
const checkDigit = (digits, length) => {
  let sum = 0;
  let weight = length + 1;
  for (let i = 0; i < length; i += 1) {
    sum += Number(digits[i]) * weight;
    weight -= 1;
  }
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
};

// Valida formato (11 dígitos) e os dois dígitos verificadores.
const isValidCpf = (value) => {
  const cpf = normalizeCpf(value);

  if (cpf.length !== 11) return false;

  // Rejeita sequências repetidas (ex.: 000... / 111...), que passam no
  // cálculo dos dígitos verificadores mas não são CPFs válidos.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  if (checkDigit(cpf, 9) !== Number(cpf[9])) return false;
  if (checkDigit(cpf, 10) !== Number(cpf[10])) return false;

  return true;
};

// Mascara o CPF para exibição mínima quando estritamente necessário:
// 123.456.789-09 -> ***.***.789-**
const maskCpf = (value) => {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11) return null;
  return `***.***.${cpf.slice(6, 9)}-**`;
};

module.exports = { normalizeCpf, isValidCpf, maskCpf };
