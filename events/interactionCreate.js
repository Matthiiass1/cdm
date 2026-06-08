const {
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

const { formatEuro, parseEuroInput } = require('../utils/formatters');
const {
  getAllMatches,
  getAllBets,
  saveBet,
  getResults,
  getUserBalance,
  setUserBalance,
  getChoiceLabel,
  getOddsForChoice,
  saveResult,
  settleMatchBets,
  getHomeDisplay,
  getAwayDisplay
} = require('../services/userBetService');

const {
  runtimeState,
  buildAdminEmbed,
  buildAdminButtons,
  sendBetLogMessage,
  sendResultMessage,
  deleteMessageById,
  reorderUpcomingMessages
} = require('../services/matchService');

const { refreshLeaderboardMessage } = require('../services/leaderboardService');

module.exports = {
  name: 'interactionCreate',
  once: false,

  async execute(client, interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
          await command.execute(interaction);
        } catch (error) {
          console.error(`❌ Erreur commande /${interaction.commandName} :`, error);

          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: '❌ Une erreur est survenue pendant l’exécution de la commande.',
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: '❌ Une erreur est survenue pendant l’exécution de la commande.',
              ephemeral: true
            });
          }
        }

        return;
      }

      if (interaction.isButton()) {
        if (interaction.customId.startsWith('bet:')) {
          const [, matchId, choice] = interaction.customId.split(':');
          const matches = getAllMatches();
          const match = matches.find(m => String(m.id) === String(matchId));

          if (!match) {
            return interaction.reply({
              content: '❌ Match introuvable.',
              ephemeral: true
            });
          }

          if (getResults()[String(matchId)]) {
            return interaction.reply({
              content: '❌ Ce match est déjà terminé.',
              ephemeral: true
            });
          }

          if (Date.now() >= new Date(match.date).getTime()) {
            return interaction.reply({
              content: `🔒 Les paris sont fermés pour **${getHomeDisplay(match)} vs ${getAwayDisplay(match)}**`,
              ephemeral: true
            });
          }

          const balance = getUserBalance(interaction.user.id, interaction.user.tag);

          const modal = new ModalBuilder()
            .setCustomId(`bet_amount:${match.id}:${choice}`)
            .setTitle(`Pari • ${match.homeTeam} vs ${match.awayTeam}`);

          const amountInput = new TextInputBuilder()
            .setCustomId('bet_amount_value')
            .setLabel(`Montant à miser en € (solde: ${formatEuro(balance)})`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex: 2 ou 2.50')
            .setMaxLength(10);

          modal.addComponents(
            new ActionRowBuilder().addComponents(amountInput)
          );

          return interaction.showModal(modal);
        }

        if (interaction.customId.startsWith('score:')) {
          if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
              content: '❌ Seuls les admins peuvent entrer le score.',
              ephemeral: true
            });
          }

          const [, matchId] = interaction.customId.split(':');
          const matches = getAllMatches();
          const match = matches.find(m => String(m.id) === String(matchId));

          if (!match) {
            return interaction.reply({
              content: '❌ Match introuvable.',
              ephemeral: true
            });
          }

          const modal = new ModalBuilder()
            .setCustomId(`score_modal:${match.id}`)
            .setTitle(`Score • ${match.homeTeam} vs ${match.awayTeam}`);

          const homeScoreInput = new TextInputBuilder()
            .setCustomId('home_score')
            .setLabel(`Score ${match.homeTeam}`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex: 2')
            .setMaxLength(2);

          const awayScoreInput = new TextInputBuilder()
            .setCustomId('away_score')
            .setLabel(`Score ${match.awayTeam}`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex: 1')
            .setMaxLength(2);

          modal.addComponents(
            new ActionRowBuilder().addComponents(homeScoreInput),
            new ActionRowBuilder().addComponents(awayScoreInput)
          );

          return interaction.showModal(modal);
        }
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('bet_amount:')) {
          const [, matchId, choice] = interaction.customId.split(':');
          const matches = getAllMatches();
          const match = matches.find(m => String(m.id) === String(matchId));

          if (!match) {
            return interaction.reply({
              content: '❌ Match introuvable.',
              ephemeral: true
            });
          }

          if (getResults()[String(matchId)]) {
            return interaction.reply({
              content: '❌ Ce match est déjà terminé.',
              ephemeral: true
            });
          }

          if (Date.now() >= new Date(match.date).getTime()) {
            return interaction.reply({
              content: '🔒 Les paris sont fermés.',
              ephemeral: true
            });
          }

          const amountRaw = interaction.fields.getTextInputValue('bet_amount_value');
          const amount = parseEuroInput(amountRaw);

          if (Number.isNaN(amount) || amount <= 0) {
            return interaction.reply({
              content: '❌ Montant invalide. Exemple : 2 ou 2.50',
              ephemeral: true
            });
          }

          const oldBet = getAllBets().find(
            b => String(b.userId) === String(interaction.user.id) && String(b.matchId) === String(matchId)
          );

          const currentBalance = getUserBalance(interaction.user.id, interaction.user.tag);
          const oldAmount = Number(oldBet?.amount ?? 0);
          const availableBalance = currentBalance + oldAmount;

          if (amount > availableBalance) {
            return interaction.reply({
              content: `❌ Solde insuffisant. Solde disponible : **${formatEuro(availableBalance)}**`,
              ephemeral: true
            });
          }

          if (oldBet && !oldBet.settled) {
            setUserBalance(interaction.user.id, interaction.user.tag, availableBalance - amount);
          } else {
            setUserBalance(interaction.user.id, interaction.user.tag, currentBalance - amount);
          }

          const odds = getOddsForChoice(match, choice);

          saveBet({
            userId: interaction.user.id,
            username: interaction.user.tag,
            matchId: String(matchId),
            choice,
            amount,
            oddsAtBet: odds,
            settled: false,
            createdAt: oldBet?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          await sendBetLogMessage(
            client,
            `<@${interaction.user.id}>`,
            match,
            choice,
            amount,
            odds
          );

          const newBalance = getUserBalance(interaction.user.id, interaction.user.tag);

          return interaction.reply({
            content:
              `✅ Pari enregistré sur **${getChoiceLabel(match, choice)}** pour **${formatEuro(amount)}**\n` +
              `💸 Cote: **${odds}**\n` +
              `💰 Nouveau solde: **${formatEuro(newBalance)}**`,
            ephemeral: true
          });
        }

        if (interaction.customId.startsWith('score_modal:')) {
          if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
              content: '❌ Seuls les admins peuvent valider le score.',
              ephemeral: true
            });
          }

          const [, matchId] = interaction.customId.split(':');
          const matches = getAllMatches();
          const match = matches.find(m => String(m.id) === String(matchId));

          if (!match) {
            return interaction.reply({
              content: '❌ Match introuvable.',
              ephemeral: true
            });
          }

          const existingResult = getResults()[String(matchId)];
          if (existingResult) {
            return interaction.reply({
              content: '❌ Ce match a déjà été validé.',
              ephemeral: true
            });
          }

          const homeScore = Number(interaction.fields.getTextInputValue('home_score'));
          const awayScore = Number(interaction.fields.getTextInputValue('away_score'));

          if (
            Number.isNaN(homeScore) ||
            Number.isNaN(awayScore) ||
            homeScore < 0 ||
            awayScore < 0
          ) {
            return interaction.reply({
              content: '❌ Les scores doivent être des nombres positifs.',
              ephemeral: true
            });
          }

          let choice = 'draw';
          if (homeScore > awayScore) choice = 'home';
          if (awayScore > homeScore) choice = 'away';

          const { winnersCount, losersCount } = settleMatchBets(match, choice);

          saveResult(String(matchId), {
            choice,
            homeScore,
            awayScore,
            validatedBy: interaction.user.id,
            validatedByTag: interaction.user.tag,
            validatedAt: new Date().toISOString()
          });

          const liveChannel = await client.channels.fetch(process.env.LIVE_CHANNEL_ID).catch(() => null);

          if (liveChannel && liveChannel.isTextBased()) {
            const upcomingMessageId = runtimeState.upcomingMessages.get(String(matchId));
            if (upcomingMessageId) {
              await deleteMessageById(liveChannel, upcomingMessageId);
              runtimeState.upcomingMessages.delete(String(matchId));
            }

            const liveMessageId = runtimeState.liveMessages.get(String(matchId));
            if (liveMessageId) {
              await deleteMessageById(liveChannel, liveMessageId);
              runtimeState.liveMessages.delete(String(matchId));
            }

            await reorderUpcomingMessages(liveChannel, getAllMatches());
          }

          await sendResultMessage(
            client,
            match,
            choice,
            interaction.user.tag,
            homeScore,
            awayScore,
            winnersCount,
            losersCount
          );

          await refreshLeaderboardMessage(client);

          await interaction.update({
            embeds: [
              buildAdminEmbed(
                match,
                `Résultat validé : ${match.homeTeam} ${homeScore}-${awayScore} ${match.awayTeam} par ${interaction.user.tag}`
              )
            ],
            components: [buildAdminButtons(match, true)]
          });
        }
      }
    } catch (error) {
      console.error('❌ Erreur interaction :', error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Une erreur est survenue.',
          ephemeral: true
        });
      }
    }
  }
};