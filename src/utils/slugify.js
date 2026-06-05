// Gera um slug a partir de um texto: remove acentos, baixa a caixa e troca
// qualquer sequência não-alfanumérica por hífen (sem hífens nas pontas).
// Ex.: "Energia e Iluminação" -> "energia-e-iluminacao".
const slugify = (text) =>
  String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

module.exports = { slugify };
