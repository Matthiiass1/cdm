const fs = require('fs');
const path = require('path');

function loadEvents(client) {
  const eventsPath = path.join(process.cwd(), 'events');

  if (!fs.existsSync(eventsPath)) {
    console.log('⚠️ Dossier events introuvable.');
    return;
  }

  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    delete require.cache[require.resolve(filePath)];
    const event = require(filePath);

    if (!event.name || !event.execute) {
      console.log(`⚠️ Event invalide ignoré : ${file}`);
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(client, ...args));
    } else {
      client.on(event.name, (...args) => event.execute(client, ...args));
    }

    console.log(`✅ Event chargé : ${event.name}`);
  }
}

module.exports = { loadEvents };