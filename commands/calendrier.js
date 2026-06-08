const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAllMatches } = require('../services/userBetService');

function toDiscordTimestamp(date) {
  return Math.floor(new Date(date).getTime() / 1000);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('calendrier')
    .setDescription('Affiche le calendrier des matchs à venir')
    .addIntegerOption(option =>
      option
        .setName('nombre')
        .setDescription('Nombre de matchs à afficher')
        .setMinValue(1)
        .setMaxValue(20)
    ),

  async execute(interaction) {
    const nombre = interaction.options.getInteger('nombre') ?? 5;

    const matches = getAllMatches()
      .filter(match => new Date(match.date).getTime() >= Date.now())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, nombre);

    if (!matches.length) {
      return interaction.reply({
        content: 'Aucun match à venir dans le calendrier.',
        ephemeral: true
      });
    }

    const description = matches.map((match, index) => {
      const ts = toDiscordTimestamp(match.date);
      return [
        `**${index + 1}. ${match.homeFlag} ${match.homeTeam} vs ${match.awayFlag} ${match.awayTeam}**`,
        `🏆 ${match.competition}`,
        `📍 ${match.stadium || 'Stade inconnu'}`,
        `🗓️ <t:${ts}:F>`,
        `⏰ <t:${ts}:R>`,
        `${match.phase ? `📌 ${match.phase}` : ''}`
      ].filter(Boolean).join('\n');
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('Calendrier des matchs')
      .setDescription(description)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};