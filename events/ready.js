const { REST, Routes } = require('discord.js');
const { runMatchScheduler } = require('../services/matchService');
const {
  refreshLeaderboardMessage,
  scheduleDailyLeaderboardRefresh
} = require('../services/leaderboardService');

async function registerSlashCommands(client) {
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;
  const token = process.env.DISCORD_TOKEN;

  if (!clientId || !guildId || !token) {
    console.log('⚠️ CLIENT_ID, GUILD_ID ou DISCORD_TOKEN manquant pour enregistrer les slash commands.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const body = client.commands.map(command => command.data.toJSON());

  try {
    console.log(`🔄 Enregistrement de ${body.length} commande(s) slash...`);
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body }
    );
    console.log('✅ Commandes slash enregistrées.');
  } catch (error) {
    console.error('❌ Erreur enregistrement slash commands :', error);
  }
}

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    await registerSlashCommands(client);
    await runMatchScheduler(client);
    await refreshLeaderboardMessage(client);
    scheduleDailyLeaderboardRefresh(client);

    const interval = Number(process.env.CHECK_INTERVAL_MS || 5000);

    setInterval(async () => {
      try {
        await runMatchScheduler(client);
      } catch (error) {
        console.error('❌ Erreur scheduler :', error);
      }
    }, interval);
  }
};