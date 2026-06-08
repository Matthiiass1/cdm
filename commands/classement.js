const { SlashCommandBuilder } = require('discord.js');
const {
  buildLeaderboardData,
  buildClassementEmbed
} = require('../services/leaderboardService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('classement')
    .setDescription('Affiche le classement des joueurs')
    .addIntegerOption(option =>
      option
        .setName('top')
        .setDescription('Nombre de joueurs à afficher')
        .setRequired(false)
        .setMinValue(3)
        .setMaxValue(20)
    ),

  async execute(interaction) {
    const top = interaction.options.getInteger('top') || 10;
    const rows = buildLeaderboardData();

    if (!rows.length) {
      return interaction.reply({
        content: '❌ Aucun joueur trouvé pour le moment.',
        ephemeral: true
      });
    }

    const embed = buildClassementEmbed(rows, interaction.user.id, top);

    return interaction.reply({
      embeds: [embed]
    });
  }
};