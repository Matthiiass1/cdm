const {
  MATCHES_FILE,
  BETS_FILE,
  RESULTS_FILE,
  USERS_FILE,
  START_BALANCE_EUR
} = require('../config/constants');
const { readJson, writeJson, ensureFile } = require('../utils/fileUtils');

ensureFile(MATCHES_FILE, []);
ensureFile(BETS_FILE, []);
ensureFile(RESULTS_FILE, {});
ensureFile(USERS_FILE, {});

function getAllMatches() {
  return readJson(MATCHES_FILE, []).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function getAllBets() {
  return readJson(BETS_FILE, []);
}

function saveAllBets(bets) {
  writeJson(BETS_FILE, bets);
}

function saveBet(bet) {
  const bets = getAllBets();
  const index = bets.findIndex(
    b => String(b.userId) === String(bet.userId) && String(b.matchId) === String(bet.matchId)
  );

  if (index !== -1) {
    bets[index] = {
      ...bets[index],
      ...bet
    };
  } else {
    bets.push(bet);
  }

  saveAllBets(bets);
}

function getResults() {
  return readJson(RESULTS_FILE, {});
}

function saveResult(matchId, resultData) {
  const results = getResults();
  results[String(matchId)] = resultData;
  writeJson(RESULTS_FILE, results);
}

function getUsers() {
  return readJson(USERS_FILE, {});
}

function saveUsers(users) {
  writeJson(USERS_FILE, users);
}

function ensureUser(userId, username = 'Unknown') {
  const users = getUsers();

  if (!users[String(userId)]) {
    users[String(userId)] = {
      userId: String(userId),
      username,
      balance: START_BALANCE_EUR,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveUsers(users);
  }

  return users[String(userId)];
}

function getUserBalance(userId, username = 'Unknown') {
  const user = ensureUser(userId, username);
  return Number(user.balance ?? START_BALANCE_EUR);
}

function setUserBalance(userId, username, newBalance) {
  const users = getUsers();
  const safeBalance = Math.round(newBalance * 100) / 100;

  if (!users[String(userId)]) {
    users[String(userId)] = {
      userId: String(userId),
      username,
      balance: safeBalance,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  } else {
    users[String(userId)].username = username;
    users[String(userId)].balance = safeBalance;
    users[String(userId)].updatedAt = new Date().toISOString();
  }

  saveUsers(users);
  return users[String(userId)];
}

function addUserBalance(userId, username, amount) {
  const current = getUserBalance(userId, username);
  return setUserBalance(userId, username, current + amount);
}

function getHomeDisplay(match) {
  return `${match.homeFlag} ${match.homeTeam}`;
}

function getAwayDisplay(match) {
  return `${match.awayFlag} ${match.awayTeam}`;
}

function getChoiceLabel(match, choice) {
  if (choice === 'home') return `${match.homeFlag} ${match.homeTeam}`;
  if (choice === 'away') return `${match.awayFlag} ${match.awayTeam}`;
  return '🤝 Match nul';
}

function getOddsForChoice(match, choice) {
  if (choice === 'home') return Number(match.odds?.home ?? 1);
  if (choice === 'away') return Number(match.odds?.away ?? 1);
  return Number(match.odds?.draw ?? 1);
}

function settleMatchBets(match, resultChoice) {
  const bets = getAllBets();
  const updatedBets = [];
  let winnersCount = 0;
  let losersCount = 0;

  for (const bet of bets) {
    if (String(bet.matchId) !== String(match.id)) {
      updatedBets.push(bet);
      continue;
    }

    if (bet.settled) {
      updatedBets.push(bet);
      continue;
    }

    const stake = Number(bet.amount ?? 0);
    const won = bet.choice === resultChoice;
    const odds = Number(bet.oddsAtBet ?? getOddsForChoice(match, bet.choice));

    if (won) {
      const payout = Math.round(stake * odds * 100) / 100;
      addUserBalance(bet.userId, bet.username, payout);
      winnersCount++;
      updatedBets.push({
        ...bet,
        settled: true,
        settledAt: new Date().toISOString(),
        result: 'win',
        payout
      });
    } else {
      losersCount++;
      updatedBets.push({
        ...bet,
        settled: true,
        settledAt: new Date().toISOString(),
        result: 'lose',
        payout: 0
      });
    }
  }

  saveAllBets(updatedBets);
  return { winnersCount, losersCount };
}

module.exports = {
  getAllMatches,
  getAllBets,
  saveBet,
  getResults,
  saveResult,
  getUsers,
  ensureUser,
  getUserBalance,
  setUserBalance,
  addUserBalance,
  getHomeDisplay,
  getAwayDisplay,
  getChoiceLabel,
  getOddsForChoice,
  settleMatchBets
};