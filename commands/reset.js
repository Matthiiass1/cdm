const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const {
  BETS_FILE,
  RESULTS_FILE,
  USERS_FILE,
  LEADERBOARD_STATE_FILE,
  START_BALANCE_EUR
} = require('../config/constants');

const { readJson, writeJson, ensureFile } = require('../utils/fileUtils');
const { formatEuro } = require('../utils/formatters');
const { refreshLeaderboardMessage } = require('../services/leaderboardService');

ensureFile(BETS_FILE, []);
ensureFile(RESULTS_FILE, {});
ensureFile(USERS_FILE, {});
ensureFile(LEADERBOARD_STATE_FILE, { messageId: null });

function getUsers() {
  return readJson(USERS_FILE, {});
}

function getBets() {
  return readJson(BETS_FILE, []);
}

function getResults() {
  return readJson(RESULTS_FILE, {});
}

function resetAllUsersBalance() {
  const users = getUsers();
  let count = 0;

  for (const userId of Object.keys(users)) {
    users[userId].balance = START_BALANCE_EUR;
    users[userId].updatedAt = new Date().toISOString();
    count++;
  }

  writeJson(USERS_FILE, users);
  return count;
}

function resetOneUserBalance(targetUser) {
  const users = getUsers();

  if (!users[String(targetUser.id)]) {
    users[String(targetUser.id)] = {
      userId: String(targetUser.id),
      username: targetUser.tag,
      balance: START_BALANCE_EUR,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  } else {
    users[String(targetUser.id)].username = targetUser.tag;
    users[String(targetUser.id)].balance = START_BALANCE_EUR;
    users[String(targetUser.id)].updatedAt = new Date().toISOString();
  }

  writeJson(USERS_FILE, users);
}

function resetAllBets() {
  const bets = getBets();
  writeJson(BETS_FILE, []);
  return bets.length;
}

function resetAllResults() {
  const results = getResults();
  const count = Object.keys(results).length;
  writeJson(RESULTS_FILE, {});
  return count;
}

function resetAllUsersData() {
  const users = getUsers();
  const count = Object.keys(users).length;
  writeJson(USERS_FILE, {});
  return count;
}

function removeUserBets(targetUserId) {
  const bets = getBets();
  const filtered = bets.filter(b => String(b.userId) !== String(targetUserId));
  const removed = bets.length - filtered.length;
  writeJson(BETS_FILE, filtered);
  return removed;
}

function buildResetEmbed(title, description, fields = []) {
  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  if (fields.length) {
    embed.addFields(fields);
  }

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Réinitialise les données du bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addSubcommand(subcommand =>
      subcommand
        .setName('user')
        .setDescription('Reset l’argent et les paris d’un utilisateur')
        .addUserOption(option =>
          option
            .setName('target')
            .setDescription('Utilisateur à reset')
            .setRequired(true)
        )
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName('server')
        .setDescription('Reset l’argent de tous les utilisateurs')
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName('bets')
        .setDescription('Supprime tous les paris')
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName('results')
        .setDescription('Supprime tous les résultats')
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName('all')
        .setDescription('Reset total : users, paris, résultats')
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ Seuls les administrateurs peuvent utiliser cette commande.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'user') {
      const target = interaction.options.getUser('target');

      resetOneUserBalance(target);
      const removedBets = removeUserBets(target.id);

      await refreshLeaderboardMessage(interaction.client);

      return interaction.reply({
        embeds: [
          buildResetEmbed(
            '♻️ Reset utilisateur',
            `${target} a été réinitialisé.`,
            [
              {
                name: '💰 Nouveau solde',
                value: `**${formatEuro(START_BALANCE_EUR)}**`,
                inline: true
              },
              {
                name: '🎟 Paris supprimés',
                value: `**${removedBets}**`,
                inline: true
              },
              {
                name: '👮 Action par',
                value: interaction.user.tag,
                inline: true
              }
            ]
          )
        ],
        ephemeral: true
      });
    }

    if (subcommand === 'server') {
      const count = resetAllUsersBalance();

      await refreshLeaderboardMessage(interaction.client);

      return interaction.reply({
        embeds: [
          buildResetEmbed(
            '♻️ Reset argent serveur',
            'Tous les soldes utilisateurs ont été réinitialisés.',
            [
              {
                name: '👥 Utilisateurs impactés',
                value: `**${count}**`,
                inline: true
              },
              {
                name: '💰 Solde par défaut',
                value: `**${formatEuro(START_BALANCE_EUR)}**`,
                inline: true
              },
              {
                name: '👮 Action par',
                value: interaction.user.tag,
                inline: true
              }
            ]
          )
        ],
        ephemeral: true
      });
    }

    if (subcommand === 'bets') {
      const removed = resetAllBets();

      await refreshLeaderboardMessage(interaction.client);

      return interaction.reply({
        embeds: [
          buildResetEmbed(
            '♻️ Reset paris',
            'Tous les paris ont été supprimés.',
            [
              {
                name: '🎟 Paris supprimés',
                value: `**${removed}**`,
                inline: true
              },
              {
                name: '👮 Action par',
                value: interaction.user.tag,
                inline: true
              }
            ]
          )
        ],
        ephemeral: true
      });
    }

    if (subcommand === 'results') {
      const removed = resetAllResults();

      return interaction.reply({
        embeds: [
          buildResetEmbed(
            '♻️ Reset résultats',
            'Tous les résultats ont été supprimés.',
            [
              {
                name: '✅ Résultats supprimés',
                value: `**${removed}**`,
                inline: true
              },
              {
                name: '👮 Action par',
                value: interaction.user.tag,
                inline: true
              }
            ]
          )
        ],
        ephemeral: true
      });
    }

    if (subcommand === 'all') {
      const usersCount = resetAllUsersData();
      const betsCount = resetAllBets();
      const resultsCount = resetAllResults();

      await refreshLeaderboardMessage(interaction.client);

      return interaction.reply({
        embeds: [
          buildResetEmbed(
            '☢️ Reset total',
            'Toutes les données ont été réinitialisées.',
            [
              {
                name: '👥 Utilisateurs supprimés',
                value: `**${usersCount}**`,
                inline: true
              },
              {
                name: '🎟 Paris supprimés',
                value: `**${betsCount}**`,
                inline: true
              },
              {
                name: '✅ Résultats supprimés',
                value: `**${resultsCount}**`,
                inline: true
              }
            ]
          )
        ],
        ephemeral: true
      });
    }
  }
};