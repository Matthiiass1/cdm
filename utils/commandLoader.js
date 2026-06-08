const fs = require('fs');
const path = require('path');

function loadCommands(client) {
  const commandsPath = path.join(process.cwd(), 'commands');

  if (!fs.existsSync(commandsPath)) {
    console.log('⚠️ Dossier commands introuvable.');
    return;
  }

  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    delete require.cache[require.resolve(filePath)];
    const command = require(filePath);

    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      console.log(`✅ Commande chargée : ${command.data.name}`);
    } else {
      console.log(`⚠️ Commande invalide ignorée : ${file}`);
    }
  }
}

module.exports = { loadCommands };