import { ContextMenuCommandBuilder, ApplicationCommandType, MessageFlags, PermissionFlagsBits, ChannelType } from 'discord.js';

const BULK_DELETEABLE_CHANNELS = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

export const data = new ContextMenuCommandBuilder()
	.setName('Delete up to here')
	.setType(ApplicationCommandType.Message)
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
	.setDMPermission(false);

export async function execute(interaction) {
	// Check if user is administrator (already guarded by defaultMemberPermissions, but good to double check)
	if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
		return await interaction.reply({ content: 'Only administrators can use this command!', flags: MessageFlags.Ephemeral });
	}

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	try {
		if (!interaction.guild) {
			return await interaction.editReply({ content: '❌ This command only works in servers.' });
		}
		const targetMessage = interaction.targetMessage;
		const channel = interaction.channel;
		if (!BULK_DELETEABLE_CHANNELS.includes(channel.type)) {
			return await interaction.editReply({ content: '❌ Deleting messages only works in text or announcement channels.' });
		}

		// Fetch all messages from now until the target message (inclusive)
		// We want to delete all messages with timestamp >= targetMessage.createdTimestamp
		let messagesToDelete = [];
		let lastMessageId = null;
		const targetTimestamp = targetMessage.createdTimestamp;
		let deletedCount = 0;

		// Fetch in batches of 100 (Discord limit)
		while (true) {
			const fetchOptions = { limit: 100 };
			if (lastMessageId) fetchOptions.before = lastMessageId;

			const fetchedMessages = await channel.messages.fetch(fetchOptions);
			
			if (fetchedMessages.size === 0) break;

			let foundOlderMessage = false;
			for (const [id, msg] of fetchedMessages) {
				// Include messages with timestamp >= target (more recent or equal)
				if (msg.createdTimestamp >= targetTimestamp) {
					messagesToDelete.push(msg);
				} else {
					// We found an older message, we can stop
					foundOlderMessage = true;
					break;
				}
			}

			// If we found older messages or there are no more messages, stop
			if (foundOlderMessage || fetchedMessages.size < 100) break;

			lastMessageId = Array.from(fetchedMessages.keys())[fetchedMessages.size - 1];
		}

		if (messagesToDelete.length === 0) {
			return await interaction.editReply({ content: '❌ No messages were found to delete.' });
		}

		// Separate into bulk-deleteable (less than 14 days old) and individual-deleteable (older)
		const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
		const bulkDeleteable = [];
		const individualDeleteable = [];

		for (const msg of messagesToDelete) {
			if (msg.createdTimestamp > fourteenDaysAgo) {
				bulkDeleteable.push(msg);
			} else {
				individualDeleteable.push(msg);
			}
		}

		// 1. Bulk delete the newer messages
		if (bulkDeleteable.length > 0) {
			for (let i = 0; i < bulkDeleteable.length; i += 100) {
				const batch = bulkDeleteable.slice(i, i + 100);
				if (batch.length === 0) continue;
				const deleted = await channel.bulkDelete(batch, true);
				deletedCount += deleted.size;
			}
		}

		// 2. Individually delete the older messages in the background
		if (individualDeleteable.length > 0) {
			await interaction.editReply({
				content: `✅ Bulk deleted ${deletedCount} newer message(s). Deleting ${individualDeleteable.length} older message(s) in the background...`
			});

			// Execute sequentially in the background to respect discord.js's rate limiting queue safely without concurrent flooding
			(async () => {
				for (const msg of individualDeleteable) {
					try {
						await msg.delete();
					} catch (err) {
						if (err.code !== 10008) { // Ignore if already deleted
							console.error(`Failed to delete message ${msg.id} individually:`, err);
						}
					}
				}
			})();
		} else {
			await interaction.editReply({ content: `✅ Deleted ${deletedCount} message(s) up to the selected message.` });
		}
	} catch (error) {
		if (error.code === 10008) {
			return await interaction.editReply({ content: '❌ Message not found!' });
		}
		console.error('Error deleting messages via context menu:', error);
		const msg = error.code === 50013 
			? '❌ The bot lacks permission (MANAGE_MESSAGES) in this channel.' 
			: '❌ Error deleting messages.';
		await interaction.editReply({ content: msg }).catch(() => {});
	}
}
