function formatEuro(amount) {
  return `${Number(amount || 0).toFixed(2)}€`;
}

function parseEuroInput(value) {
  if (value === null || value === undefined) return NaN;

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/eur/g, '')
    .replace(/€/g, '')
    .replace(/\s+/g, '')
    .replace(',', '.');

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return NaN;
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    return NaN;
  }

  return Math.round(amount * 100) / 100;
}

function getTimestamp(date) {
  return Math.floor(new Date(date).getTime() / 1000);
}

function medal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

module.exports = {
  formatEuro,
  parseEuroInput,
  getTimestamp,
  medal
};