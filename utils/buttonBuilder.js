const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function buildBetButtons(match, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bet:${match.id}:home`)
      .setLabel(`${match.homeFlag} ${match.homeTeam}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),

    new ButtonBuilder()
      .setCustomId(`bet:${match.id}:draw`)
      .setLabel('🤝 Match nul')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),

    new ButtonBuilder()
      .setCustomId(`bet:${match.id}:away`)
      .setLabel(`${match.awayFlag} ${match.awayTeam}`)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

module.exports = { buildBetButtons };