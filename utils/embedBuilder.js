const { EmbedBuilder } = require('discord.js');

function getTimestamp(date) {
  return Math.floor(new Date(date).getTime() / 1000);
}

function buildUpcomingEmbed(match) {
  const ts = getTimestamp(match.date);

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📅 Match à venir')
    .setDescription(
      `## ${match.homeFlag} ${match.homeTeam} vs ${match.awayFlag} ${match.awayTeam}\n` +
      `Les paris sont actuellement **ouverts** pour cette rencontre.`
    )
    .addFields(
      { name: '🕒 Début', value: `<t:${ts}:F>`, inline: true },
      { name: '⏳ Compte à rebours', value: `<t:${ts}:R>`, inline: true },
      { name: '🏟 Stade', value: match.stadium, inline: false },
      { name: '🎯 Paris', value: 'Choisis une équipe gagnante ou le match nul avec les boutons ci-dessous.', inline: false }
    )
    .setFooter({ text: `Coupe du monde 2026 • ${match.id}` })
    .setTimestamp();
}

function buildClosedUpcomingEmbed(match) {
  const ts = getTimestamp(match.date);

  return new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('📌 Match verrouillé')
    .setDescription(
      `## ${match.homeFlag} ${match.homeTeam} vs ${match.awayFlag} ${match.awayTeam}\n` +
      `Le match a commencé, les paris sont maintenant **fermés**.`
    )
    .addFields(
      { name: '🕒 Début', value: `<t:${ts}:F>`, inline: true },
      { name: '🔒 Statut', value: 'Paris fermés', inline: true },
      { name: '🏟 Stade', value: match.stadium, inline: false }
    )
    .setFooter({ text: `Coupe du monde 2026 • ${match.id}` })
    .setTimestamp();
}

function buildLiveEmbed(match) {
  const ts = getTimestamp(match.date);

  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('🔴 Match en cours')
    .setDescription(
      `## ${match.homeFlag} ${match.homeTeam} vs ${match.awayFlag} ${match.awayTeam}\n` +
      `La rencontre est en direct. Les paris sont **fermés**.`
    )
    .addFields(
      { name: '🕒 Coup d’envoi', value: `<t:${ts}:F>`, inline: true },
      { name: '📡 Statut', value: 'En cours', inline: true },
      { name: '🏟 Stade', value: match.stadium, inline: false }
    )
    .setFooter({ text: `Coupe du monde 2026 • ${match.id}` })
    .setTimestamp();
}

module.exports = {
  buildUpcomingEmbed,
  buildClosedUpcomingEmbed,
  buildLiveEmbed
};