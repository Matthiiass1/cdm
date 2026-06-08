const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { MATCHES_FILE, USERS_FILE, BETS_FILE, START_BALANCE_EUR } = require('../config/constants');
const { readJson, ensureFile, writeJson } = require('../utils/fileUtils');
const { formatEuro } = require('../utils/formatters');

ensureFile(USERS_FILE, {});
ensureFile(BETS_FILE, []);
ensureFile(MATCHES_FILE, []);

function getUsers() {
  return readJson(USERS_FILE, {});
}

function getBets() {
  return readJson(BETS_FILE, []);
}

function getMatches() {
  return readJson(MATCHES_FILE, []);
}

function ensureUserData(user) {
  const users = getUsers();

  if (!users[String(user.id)]) {
    users[String(user.id)] = {
      userId: String(user.id),
      username: user.tag,
      balance: START_BALANCE_EUR,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    writeJson(USERS_FILE, users);
  }

  return users[String(user.id)];
}

function getLastBet(userBets) {
  if (!userBets.length) return null;

  return [...userBets].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  })[0];
}

function getBetTargetLabel(lastBet, match) {
  if (!lastBet) return 'Inconnu';
  if (!match) {
    if (lastBet.choice === 'draw') return 'Match nul';
    if (lastBet.choice === 'home') return 'Équipe domicile';
    if (lastBet.choice === 'away') return 'Équipe extérieure';
    return 'Inconnu';
  }

  if (lastBet.choice === 'home') return `${match.homeFlag || '🏠'} ${match.homeTeam}`;
  if (lastBet.choice === 'away') return `${match.awayFlag || '✈️'} ${match.awayTeam}`;
  return '🤝 Match nul';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Affiche le profil paris et le solde d’un joueur')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Le joueur à consulter')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    const userData = ensureUserData(targetUser);
    const bets = getBets();
    const matches = getMatches();

    const userBets = bets.filter(b => String(b.userId) === String(targetUser.id));
    const settledBets = userBets.filter(b => b.settled);
    const wonBets = settledBets.filter(b => b.result === 'win');
    const lostBets = settledBets.filter(b => b.result === 'lose');
    const pendingBets = userBets.filter(b => !b.settled);

    const totalStaked = userBets.reduce((sum, bet) => sum + Number(bet.amount || 0), 0);
    const totalWonPayout = wonBets.reduce((sum, bet) => sum + Number(bet.payout || 0), 0);
    const totalLost = lostBets.reduce((sum, bet) => sum + Number(bet.amount || 0), 0);
    const biggestWin = wonBets.reduce((max, bet) => Math.max(max, Number(bet.payout || 0)), 0);
    const winRate = settledBets.length ? ((wonBets.length / settledBets.length) * 100).toFixed(1) : '0.0';

    const lastBet = getLastBet(userBets);
    const lastMatch = lastBet
      ? matches.find(m => String(m.id) === String(lastBet.matchId))
      : null;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({
        name: `Profil de ${targetUser.tag}`,
        iconURL: targetUser.displayAvatarURL()
      })
      .setThumbnail(targetUser.displayAvatarURL({ size: 512 }))
      .setTitle('💼 Profil joueur')
      .setDescription(`${targetUser} voici toutes les stats de paris disponibles.`)
      .addFields(
        { name: '💰 Solde actuel', value: `**${formatEuro(userData.balance ?? START_BALANCE_EUR)}**`, inline: true },
        { name: '🎟 Paris totaux', value: `**${userBets.length}**`, inline: true },
        { name: '⏳ Paris en attente', value: `**${pendingBets.length}**`, inline: true },
        { name: '✅ Victoires', value: `**${wonBets.length}**`, inline: true },
        { name: '❌ Défaites', value: `**${lostBets.length}**`, inline: true },
        { name: '📊 Taux de réussite', value: `**${winRate}%**`, inline: true },
        { name: '💸 Total misé', value: `**${formatEuro(totalStaked)}**`, inline: true },
        { name: '🏆 Gains bruts', value: `**${formatEuro(totalWonPayout)}**`, inline: true },
        { name: '📉 Pertes', value: `**${formatEuro(totalLost)}**`, inline: true },
        { name: '🚀 Plus gros gain', value: `**${formatEuro(biggestWin)}**`, inline: true },
        { name: '🆔 ID joueur', value: `\`${targetUser.id}\``, inline: true },
        {
          name: '📅 Compte suivi depuis',
          value: userData.createdAt
            ? `<t:${Math.floor(new Date(userData.createdAt).getTime() / 1000)}:F>`
            : 'Inconnu',
          inline: true
        }
      )
      .setFooter({ text: 'Coupe du monde 2026 • Profil paris' })
      .setTimestamp();

    if (lastBet) {
      const matchLine = lastMatch
        ? `${lastMatch.homeFlag || '🏠'} ${lastMatch.homeTeam} vs ${lastMatch.awayFlag || '✈️'} ${lastMatch.awayTeam}`
        : `Match ID: ${lastBet.matchId}`;

      const targetLine = getBetTargetLabel(lastBet, lastMatch);

      embed.addFields({
        name: '🧾 Dernier pari',
        value:
          `**Match :** ${matchLine}\n` +
          `**Parié sur :** ${targetLine}\n` +
          `**Mise :** ${formatEuro(lastBet.amount || 0)}\n` +
          `**Cote :** ${lastBet.oddsAtBet ?? 'N/A'}\n` +
          `**Statut :** ${lastBet.settled ? (lastBet.result === 'win' ? '✅ Gagné' : '❌ Perdu') : '⏳ En attente'}`,
        inline: false
      });
    } else {
      embed.addFields({
        name: '🧾 Dernier pari',
        value: 'Aucun pari enregistré pour le moment.',
        inline: false
      });
    }

    return interaction.reply({
      embeds: [embed]
    });
  }
};