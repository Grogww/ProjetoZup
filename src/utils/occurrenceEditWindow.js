// Janela de edição de uma ocorrência: depois de criada, ela só pode ser
// alterada (campos e mídias) por um período limitado a partir de created_at.
// Passado esse prazo, a ocorrência fica "congelada" como registro histórico.
const EDIT_WINDOW_HOURS = Number(process.env.OCCURRENCE_EDIT_WINDOW_HOURS) || 24;

const isWithinEditWindow = (createdAt) => {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  const deadline = created + EDIT_WINDOW_HOURS * 60 * 60 * 1000;
  return Date.now() <= deadline;
};

// Lança EDIT_WINDOW_EXPIRED se a janela já se fechou. Recebe a ocorrência
// (ou qualquer objeto com created_at) para reaproveitar a linha já buscada.
const assertWithinEditWindow = (occurrence) => {
  if (!isWithinEditWindow(occurrence.created_at)) {
    const err = new Error(
      `Occurrences can only be edited within ${EDIT_WINDOW_HOURS} hours of creation`
    );
    err.code = 'EDIT_WINDOW_EXPIRED';
    throw err;
  }
};

module.exports = { EDIT_WINDOW_HOURS, isWithinEditWindow, assertWithinEditWindow };
