const { readJson, writeJson } = require('../utils/jsonStorage');
const { getAllMatches } = require('../services/matchService');
const {
  buildUpcomingEmbed,
  buildClosedUpcomingEmbed,
  buildLiveEmbed
} = require('../utils/embedBuilder');
const { buildBetButtons } = require('../utils/buttonBuilder');

async function closeUpcomingMessage(channel, state, match) {
  const messageId = state.upcomingMessages?.[match.id];
  if (!messageId) return;

  const message = await channel.messages.fetch(messageId).catch(error => {
    console.error(`❌ Impossible de récupérer le message ${messageId} :`, error);
    return null;
  });

  if (!message) return;

  await message.edit({
    embeds: [buildClosedUpcomingEmbed(match)],
    components: [buildBetButtons(match, true)]
  }).catch(error => {
    console.error(`❌ Impossible d'éditer le message du match ${match.id} :`, error);
  });
}

async function runMatchScheduler(client) {
  const liveChannelId = process.env.LIVE_CHANNEL_ID;
  if (!liveChannelId) {
    console.log('❌ LIVE_CHANNEL_ID manquant');
    return;
  }

  const channel = await client.channels.fetch(liveChannelId).catch(error => {
    console.error('❌ Erreur fetch channel :', error);
    return null;
  });

  if (!channel || !channel.isTextBased()) {
    console.log('❌ Salon invalide');
    return;
  }

  const matches = getAllMatches();
  const state = readJson('data/state.json', {
    upcomingSent: [],
    liveSent: [],
    upcomingMessages: {}
  });

  const now = Date.now();

  console.log('----- SCHEDULER -----');
  console.log('Now:', new Date(now).toISOString());

  for (const match of matches) {
    const matchTime = new Date(match.date).getTime();
    const upcomingTime = matchTime - 2 * 60 * 1000;

    console.log({
      id: match.id,
      date: match.date,
      upcomingSent: state.upcomingSent.includes(match.id),
      liveSent: state.liveSent.includes(match.id),
      shouldSendUpcoming: !state.upcomingSent.includes(match.id) && now >= upcomingTime && now < matchTime,
      shouldSendLive: !state.liveSent.includes(match.id) && now >= matchTime
    });

    if (!state.upcomingSent.includes(match.id) && now >= upcomingTime && now < matchTime) {
      const sentMessage = await channel.send({
        embeds: [buildUpcomingEmbed(match)],
        components: [buildBetButtons(match, false)]
      }).catch(error => {
        console.error(`❌ Erreur envoi upcoming ${match.id} :`, error);
        return null;
      });

      if (sentMessage) {
        state.upcomingSent.push(match.id);
        state.upcomingMessages[match.id] = sentMessage.id;
        writeJson('data/state.json', state);
        console.log(`✅ Upcoming envoyé pour ${match.id}`);
      }
    }

    if (!state.liveSent.includes(match.id) && now >= matchTime) {
      await closeUpcomingMessage(channel, state, match);

      const liveMessage = await channel.send({
        embeds: [buildLiveEmbed(match)]
      }).catch(error => {
        console.error(`❌ Erreur envoi live ${match.id} :`, error);
        return null;
      });

      if (liveMessage) {
        state.liveSent.push(match.id);
        writeJson('data/state.json', state);
        console.log(`✅ Live envoyé pour ${match.id}`);
      }
    }
  }
}

module.exports = { runMatchScheduler };