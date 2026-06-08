const { EmbedBuilder } = require('discord.js');
const {
  USERS_FILE,
  BETS_FILE,
  LEADERBOARD_STATE_FILE,
  LEADERBOARD_CHANNEL_ID,
  START_BALANCE_EUR
} = require('../config/constants');
const { readJson, writeJson, ensureFile } = require('../utils/fileUtils');
const { formatEuro, medal } = require('../utils/formatters');

ensureFile(USERS_FILE, {});
ensureFile(BETS_FILE, []);
ensureFile(LEADERBOARD_STATE_FILE, { messageId: null });

function getUsers() {
  return readJson(USERS_FILE, {});
}

function getBets() {
  return readJson(BETS_FILE, []);
}

function getLeaderboardState() {
  return readJson(LEADERBOARD_STATE_FILE, { messageId: null });
}

function saveLeaderboardState(data) {
  writeJson(LEADERBOARD_STATE_FILE, data);
}

function buildLeaderboardData() {
  const users = getUsers();
  const bets = getBets();

  const allUserIds = new Set([
    ...Object.keys(users),
    ...bets.map(b => String(b.userId))
  ]);

  const rows = [...allUserIds].map(userId => {
    const user = users[userId] || {
      userId,
      username: `Utilisateur ${userId}`,
      balance: START_BALANCE_EUR
    };

    const userBets = bets.filter(b => String(b.userId) === String(userId));
    const settled = userBets.filter(b => b.settled);
    const wins = settled.filter(b => b.result === 'win');
    const losses = settled.filter(b => b.result === 'lose');
    const winRate = settled.length ? ((wins.length / settled.length) * 100) : 0;

    return {
      userId: String(userId),
      username: user.username || `Utilisateur ${userId}`,
      balance: Number(user.balance ?? START_BALANCE_EUR),
      totalBets: userBets.length,
      wins: wins.length,
      losses: losses.length,
      winRate
    };
  });

  rows.sort((a, b) => {
    if (b.balance !== a.balance) return b.balance - a.balance;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.totalBets !== a.totalBets) return b.totalBets - a.totalBets;
    return a.username.localeCompare(b.username, 'fr', { sensitivity: 'base' });
  });

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1
  }));
}

function buildClassementEmbed(rows, viewerId = null, top = 10) {
  if (!rows.length) {
    return new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('🏆 Classement des parieurs')
      .setDescription('Aucun joueur classé pour le moment.')
      .setTimestamp();
  }

  const topRows = rows.slice(0, top);

  const description = topRows.map(row => {
    return (
      `${medal(row.rank)} **${row.username}**\n` +
      `└ 💰 ${formatEuro(row.balance)} • 🎟 ${row.totalBets} paris • ✅ ${row.wins} wins • 📊 ${row.winRate.toFixed(1)}%`
    );
  }).join('\n\n');

  const me = viewerId
    ? rows.find(row => String(row.userId) === String(viewerId))
    : null;

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('🏆 Classement des parieurs')
    .setDescription(description)
    .setFooter({
      text: `Top ${top} • Classement trié par solde puis victoires`
    })
    .setTimestamp();

  if (me) {
    embed.addFields(
      {
        name: '📌 Ton rang',
        value: `**#${me.rank}** sur **${rows.length}** joueurs`,
        inline: true
      },
      {
        name: '💰 Ton solde',
        value: `**${formatEuro(me.balance)}**`,
        inline: true
      },
      {
        name: '🎟 Tes paris',
        value: `**${me.totalBets}**`,
        inline: true
      }
    );
  }

  return embed;
}

async function refreshLeaderboardMessage(client) {
  try {
    const leaderboardChannel = await client.channels.fetch(LEADERBOARD_CHANNEL_ID).catch(() => null);
    if (!leaderboardChannel || !leaderboardChannel.isTextBased()) {
      console.error('❌ Salon classement introuvable');
      return;
    }

    const rows = buildLeaderboardData();
    const embed = buildClassementEmbed(rows, null, 10);

    const state = getLeaderboardState();
    let message = null;

    if (state.messageId) {
      message = await leaderboardChannel.messages.fetch(state.messageId).catch(() => null);
    }

    if (message) {
      await message.edit({ embeds: [embed] });
      console.log('✅ Classement mis à jour');
      return;
    }

    const sent = await leaderboardChannel.send({ embeds: [embed] });
    saveLeaderboardState({ messageId: sent.id });
    console.log('✅ Message classement créé');
  } catch (error) {
    console.error('❌ Erreur refresh classement :', error);
  }
}

function msUntilNextMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

function scheduleDailyLeaderboardRefresh(client) {
  const delay = msUntilNextMidnight();

  setTimeout(async () => {
    await refreshLeaderboardMessage(client);

    setInterval(async () => {
      await refreshLeaderboardMessage(client);
    }, 24 * 60 * 60 * 1000);
  }, delay);
}

module.exports = {
  buildLeaderboardData,
  buildClassementEmbed,
  refreshLeaderboardMessage,
  scheduleDailyLeaderboardRefresh
};