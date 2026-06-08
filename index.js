require('dotenv').config();

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { loadCommands } = require('./utils/commandLoader');
const { loadEvents } = require('./utils/eventLoader');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

loadCommands(client);
loadEvents(client);

client.login(process.env.DISCORD_TOKEN);