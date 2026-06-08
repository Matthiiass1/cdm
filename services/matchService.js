const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  ADMIN_CHANNEL_ID,
  RESULTS_CHANNEL_ID,
  BET_LOG_CHANNEL_ID,
  UPCOMING_DELAY_MS,
  LIVE_DURATION_MS,
  START_BALANCE_EUR
} = require('../config/constants');
const { formatEuro, getTimestamp } = require('../utils/formatters');
const {
  getAllMatches,
  getAllBets,
  getResults,
  getHomeDisplay,
  getAwayDisplay,
  getChoiceLabel
} = require('./userBetService');

const runtimeState = {
  upcomingMessages: new Map(),
  liveMessages: new Map(),
  adminMessages: new Map(),
  reorderLock: false
};

function isUpcoming(match) {
  const now = Date.now();
  const matchTime = new Date(match.date).getTime();
  return now >= (matchTime - UPCOMING_DELAY_MS) && now < matchTime;
}

function isLive(match) {
  const now = Date.now();
  const matchTime = new Date(match.date).getTime();
  return now >= matchTime && now < (matchTime + LIVE_DURATION_MS);
}

function buildBetButtons(match, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bet:${match.id}:home`)
      .setLabel(match.homeTeam)
      .setEmoji(match.homeFlag)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),

    new ButtonBuilder()
      .setCustomId(`bet:${match.id}:draw`)
      .setLabel('Match nul')
      .setEmoji('🤝')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),

    new ButtonBuilder()
      .setCustomId(`bet:${match.id}:away`)
      .setLabel(match.awayTeam)
      .setEmoji(match.awayFlag)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

function buildAdminButtons(match, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`score:${match.id}`)
      .setLabel('Entrer le score')
      .setEmoji('⚽')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled)
  );
}

function buildUpcomingEmbed(match) {
  const ts = getTimestamp(match.date);

  return new EmbedBuilder()
    .setColor(0xFF7A00)
    .setTitle('🔴 Paris ouverts')
    .setDescription(`**${getHomeDisplay(match)}** vs **${getAwayDisplay(match)}**`)
    .addFields(
      { name: '🏆 Ligue', value: match.competition || 'CDM 2026', inline: true },
      { name: '🎯 Phase', value: match.phase || 'Phase de groupes', inline: true },
      { name: '📅 Match', value: `<t:${ts}:F>\n<t:${ts}:R>`, inline: false },
      { name: getHomeDisplay(match), value: `Cote : ${match.odds?.home ?? '2'}`, inline: true },
      { name: '🤝 Match nul', value: `Cote : ${match.odds?.draw ?? '2'}`, inline: true },
      { name: getAwayDisplay(match), value: `Cote : ${match.odds?.away ?? '2'}`, inline: true },
      { name: '💰 Banque de départ', value: `${formatEuro(START_BALANCE_EUR)} par joueur`, inline: false },
      { name: '⏳ Fermeture des paris', value: `<t:${ts}:F>\n<t:${ts}:R>`, inline: false }
    )
    .setTimestamp();
}

function buildLiveEmbed(match) {
  const ts = getTimestamp(match.date);

  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('🔴 Match en cours')
    .setDescription(`**${getHomeDisplay(match)}** vs **${getAwayDisplay(match)}**`)
    .addFields(
      { name: '🏆 Ligue', value: match.competition || 'CDM 2026', inline: true },
      { name: '🎯 Phase', value: match.phase || 'Phase de groupes', inline: true },
      { name: '🕒 Coup d’envoi', value: `<t:${ts}:F>`, inline: false },
      { name: '🏟 Stade', value: match.stadium || 'Stade inconnu', inline: false }
    )
    .setTimestamp();
}

function buildAdminEmbed(match, status = 'En attente du score admin') {
  const ts = getTimestamp(match.date);

  return new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('🛠 Validation admin')
    .setDescription(`**${getHomeDisplay(match)}** vs **${getAwayDisplay(match)}**`)
    .addFields(
      { name: '🕒 Début', value: `<t:${ts}:F>`, inline: true },
      { name: '📋 Statut', value: status, inline: true }
    )
    .setTimestamp();
}

function buildBetLogEmbed(userMention, match, choice, amount, odds) {
  const ts = getTimestamp(match.date);

  return new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('🧾 Nouveau pari')
    .setDescription(`${userMention} a placé un pari.`)
    .addFields(
      { name: '⚽ Match', value: `${getHomeDisplay(match)} vs ${getAwayDisplay(match)}`, inline: false },
      { name: '🎯 Pari sur', value: getChoiceLabel(match, choice), inline: true },
      { name: '💰 Mise', value: formatEuro(amount), inline: true },
      { name: '📈 Cote', value: String(odds), inline: true },
      { name: '🏆 Ligue', value: match.competition || 'CDM 2026', inline: true },
      { name: '🎯 Phase', value: match.phase || 'Phase de groupes', inline: true },
      { name: '🔒 Fermeture', value: `<t:${ts}:F>\n<t:${ts}:R>`, inline: false }
    )
    .setTimestamp();
}

function buildResultEmbed(match, choice, adminTag, homeScore, awayScore, winnersCount, losersCount) {
  return new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('✅ Résultat validé')
    .setDescription(`**${match.homeFlag} ${match.homeTeam} ${homeScore} - ${awayScore} ${match.awayFlag} ${match.awayTeam}**`)
    .addFields(
      { name: '🏆 Résultat', value: getChoiceLabel(match, choice), inline: true },
      { name: '👮 Validé par', value: adminTag, inline: true },
      { name: '✅ Gagnants', value: String(winnersCount), inline: true },
      { name: '❌ Perdants', value: String(losersCount), inline: true }
    )
    .setTimestamp();
}

async function deleteMessageById(channel, messageId) {
  if (!messageId) return;
  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return;
  await message.delete().catch(() => null);
}

async function sendUpcomingMessage(channel, match) {
  const sent = await channel.send({
    embeds: [buildUpcomingEmbed(match)],
    components: [buildBetButtons(match)]
  }).catch(error => {
    console.error(`❌ Erreur envoi upcoming ${match.id} :`, error);
    return null;
  });

  if (sent) runtimeState.upcomingMessages.set(String(match.id), sent.id);
}

async function deleteUpcomingMessage(channel, matchId) {
  const messageId = runtimeState.upcomingMessages.get(String(matchId));
  if (!messageId) return;
  await deleteMessageById(channel, messageId);
  runtimeState.upcomingMessages.delete(String(matchId));
}

async function sendLiveMessage(channel, match) {
  if (runtimeState.liveMessages.has(String(match.id))) return;

  const sent = await channel.send({
    embeds: [buildLiveEmbed(match)]
  }).catch(error => {
    console.error(`❌ Erreur envoi live ${match.id} :`, error);
    return null;
  });

  if (sent) runtimeState.liveMessages.set(String(match.id), sent.id);
}

async function sendAdminValidationMessage(client, match) {
  if (runtimeState.adminMessages.has(String(match.id))) return;

  const adminChannel = await client.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null);
  if (!adminChannel || !adminChannel.isTextBased()) return;

  const sent = await adminChannel.send({
    embeds: [buildAdminEmbed(match)],
    components: [buildAdminButtons(match)]
  }).catch(error => {
    console.error(`❌ Erreur envoi admin ${match.id} :`, error);
    return null;
  });

  if (sent) runtimeState.adminMessages.set(String(match.id), sent.id);
}

async function sendBetLogMessage(client, userMention, match, choice, amount, odds) {
  const logChannel = await client.channels.fetch(BET_LOG_CHANNEL_ID).catch(() => null);
  if (!logChannel || !logChannel.isTextBased()) return;

  await logChannel.send({
    embeds: [buildBetLogEmbed(userMention, match, choice, amount, odds)]
  }).catch(error => {
    console.error(`❌ Erreur envoi bet log ${match.id} :`, error);
  });
}

async function sendResultMessage(client, match, choice, adminTag, homeScore, awayScore, winnersCount, losersCount) {
  const resultChannel = await client.channels.fetch(RESULTS_CHANNEL_ID).catch(() => null);
  if (!resultChannel || !resultChannel.isTextBased()) return;

  await resultChannel.send({
    embeds: [buildResultEmbed(match, choice, adminTag, homeScore, awayScore, winnersCount, losersCount)]
  }).catch(error => {
    console.error(`❌ Erreur envoi résultat ${match.id} :`, error);
  });
}

function getUpcomingMatchesToDisplay(matches) {
  const results = getResults();

  return matches
    .filter(match => !results[String(match.id)])
    .filter(match => isUpcoming(match))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function cleanupRuntimeState(matches) {
  const validIds = new Set(matches.map(m => String(m.id)));

  for (const [id] of runtimeState.upcomingMessages) {
    if (!validIds.has(id)) runtimeState.upcomingMessages.delete(id);
  }

  for (const [id] of runtimeState.liveMessages) {
    if (!validIds.has(id)) runtimeState.liveMessages.delete(id);
  }

  for (const [id] of runtimeState.adminMessages) {
    if (!validIds.has(id)) runtimeState.adminMessages.delete(id);
  }
}

async function reorderUpcomingMessages(channel, matches) {
  if (runtimeState.reorderLock) return;
  runtimeState.reorderLock = true;

  try {
    const upcomingMatches = getUpcomingMatchesToDisplay(matches);

    for (const match of upcomingMatches) {
      const oldMessageId = runtimeState.upcomingMessages.get(String(match.id));
      if (oldMessageId) {
        await deleteMessageById(channel, oldMessageId);
      }
      runtimeState.upcomingMessages.delete(String(match.id));
    }

    for (const match of upcomingMatches) {
      await sendUpcomingMessage(channel, match);
    }
  } finally {
    runtimeState.reorderLock = false;
  }
}

async function runMatchScheduler(client) {
  const liveChannelId = process.env.LIVE_CHANNEL_ID;
  if (!liveChannelId) {
    console.error('❌ LIVE_CHANNEL_ID manquant');
    return;
  }

  const liveChannel = await client.channels.fetch(liveChannelId).catch(() => null);
  if (!liveChannel || !liveChannel.isTextBased()) {
    console.error('❌ Salon live introuvable');
    return;
  }

  const matches = getAllMatches();
  const results = getResults();
  cleanupRuntimeState(matches);

  let shouldReorderUpcoming = false;

  for (const match of matches) {
    const matchId = String(match.id);
    const result = results[matchId];

    const shouldBeUpcoming =
      !result &&
      isUpcoming(match) &&
      !runtimeState.upcomingMessages.has(matchId);

    const shouldBeLive =
      !result &&
      isLive(match) &&
      !runtimeState.liveMessages.has(matchId);

    if (shouldBeUpcoming) shouldReorderUpcoming = true;

    if (shouldBeLive) {
      await deleteUpcomingMessage(liveChannel, matchId);
      await sendLiveMessage(liveChannel, match);
      await sendAdminValidationMessage(client, match);
      shouldReorderUpcoming = true;
    }
  }

  if (shouldReorderUpcoming) {
    await reorderUpcomingMessages(liveChannel, matches);
  }
}

module.exports = {
  runtimeState,
  isUpcoming,
  isLive,
  buildAdminEmbed,
  buildAdminButtons,
  sendBetLogMessage,
  sendResultMessage,
  deleteMessageById,
  reorderUpcomingMessages,
  runMatchScheduler
};