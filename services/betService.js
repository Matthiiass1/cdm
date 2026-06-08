const { readJson, writeJson } = require('../utils/jsonStorage');

function saveBet(bet) {
  const bets = readJson('data/bets.json', []);
  bets.push(bet);
  writeJson('data/bets.json', bets);
}

module.exports = { saveBet };