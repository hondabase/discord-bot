import moment from 'moment-timezone';
import { PermissionFlagsBits } from 'discord.js';

import { getUserTimezone } from '../handlers/TimezoneHandler.js';
import { STAFF_CHANNEL_ID, STAFF_ROLE_ID } from '../config.js';
import { logUserActivity } from '../utils/database.js';
import { checkMessageForBlockedImage } from '../utils/imageFingerprints.js';
import { isAuthorized, handleThreadMessage, queryOllama, generateThreadTitle, splitMessage, startLoadingAnimation } from '../handlers/AiHandler.js';

const INVITE_LINK_REGEX = /(discord\.gg\/|discord\.com\/invite\/)/i;

export async function execute(client, message) {
	if (message.author.bot) return;
	logUserActivity(message.author.id, message.author.username, 'message').catch(error => console.error('Failed to log message activity:', error));
	const isStaffMessage = message.member && message.member.roles.cache.has(STAFF_ROLE_ID);

	try {
		const match = await checkMessageForBlockedImage(message);
		if (match) {
			await message.delete().catch(console.error);
			const warning = await message.channel.send(`${message.author}, that image is blocked on this server.`);
			setTimeout(() => warning.delete().catch(() => {}), 10000);
			console.log(`Removed blocked image from ${message.author.tag}; fingerprint ${match.fingerprint}, distance ${match.distance}`);
			return;
		}
	} catch (error) {
		console.error('Failed to check message images:', error);
	}

	// Check for Discord invite links
	if (!isStaffMessage && INVITE_LINK_REGEX.test(message.content)) {
		if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

		await message.delete().catch(console.error); // Delete the message
		await message.channel.send(`${message.author}, posting invite links is not allowed!`).then(msg => setTimeout(() => msg.delete(), 5000));

		// Post the original message and details to the staff channel
		const staffChannel = message.guild.channels.cache.get(STAFF_CHANNEL_ID);
		if (staffChannel) {
			staffChannel.send(`🚨 **Invite Link Blocked** 🚨\n**User:** ${message.author.tag} (${message.author.id})\n**Message:** ${message.content}`);
		} else {
			console.error(`Staff channel with ID ${STAFF_CHANNEL_ID} not found.`);
		}
	}

	// AI Assistant thread handling
	if (message.channel.isThread()) {
		if (message.channel.ownerId === client.user.id) {
			if (isAuthorized(message.member)) {
				await handleThreadMessage(client, message);
			}
			return;
		}
	}

	// AI Assistant main channel reply continuation
	if (message.reference && message.reference.messageId) {
		try {
			const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
			if (repliedMsg.author.id === client.user.id) {
				if (isAuthorized(message.member)) {
					const history = [];
					if (repliedMsg.reference && repliedMsg.reference.messageId) {
						try {
							const firstPromptMsg = await message.channel.messages.fetch(repliedMsg.reference.messageId);
							if (firstPromptMsg) {
								history.push({ 
									role: 'user', 
									content: firstPromptMsg.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim() 
								});
							}
						} catch (e) {
							// ignore
						}
					}

					history.push({ role: 'assistant', content: repliedMsg.content });
					history.push({ 
						role: 'user', 
						content: message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim() 
					});

					// Create the thread and status message immediately
					const thread = await repliedMsg.startThread({
						name: 'Hondabase+ AI Chat',
						autoArchiveDuration: 60
					});
					const statusMsg = await thread.send('⏳ Enqueued.');
					const anim = startLoadingAnimation(statusMsg, '⏳ Enqueued.');

					// Callback to handle real-time queue updates
					const onQueueUpdate = async (pos, isProcessing) => {
						try {
							if (isProcessing) {
								anim.updateText('✍️ Soichiro is thinking');
								await thread.sendTyping().catch(() => {});
							} else {
								anim.updateText(`⏳ Enqueued. Position in queue: ${pos}`);
							}
						} catch (err) {
							// Fail silently
						}
					};

					const userPrompt = history[0] ? history[0].content : message.content;
					const replyText = await queryOllama(history, onQueueUpdate);
					anim.stop();

					const chunks = splitMessage(replyText);

					await statusMsg.edit(`${message.author}, ${chunks[0]}`);
					for (const chunk of chunks) {
						if (chunk !== chunks[0]) {
							await thread.send(chunk);
						}
					}

					// Set the thread name dynamically in the background
					generateThreadTitle(userPrompt, repliedMsg.content).then(threadTitle => {
						thread.setName(threadTitle).catch(console.error);
					});
				}
				return;
			}
		} catch (error) {
			console.error('Error handling reply continuation:', error);
		}
	}

	// AI Assistant main channel mention check
	const botMentionRegex = new RegExp(`<@!?${client.user.id}>`);
	if (botMentionRegex.test(message.content)) {
		if (isAuthorized(message.member)) {
			const cleanPrompt = message.content.replace(botMentionRegex, '').trim();
			if (!cleanPrompt) {
				await message.reply('How can I help you today?');
				return;
			}

			const statusMsg = await message.reply('⏳ Enqueued.');
			const anim = startLoadingAnimation(statusMsg, '⏳ Enqueued.');

			// Callback to handle real-time queue updates
			const onQueueUpdate = async (pos, isProcessing) => {
				try {
					if (isProcessing) {
						anim.updateText('✍️ Soichiro is thinking');
						await message.channel.sendTyping().catch(() => {});
					} else {
						anim.updateText(`⏳ Enqueued. Position in queue: ${pos}`);
					}
				} catch (err) {
					// Fail silently
				}
			};

			const messages = [{ role: 'user', content: cleanPrompt }];
			const responseText = await queryOllama(messages, onQueueUpdate);
			anim.stop();

			const chunks = splitMessage(responseText);

			await statusMsg.edit(chunks[0]);
			for (let i = 1; i < chunks.length; i++) {
				await message.channel.send(chunks[i]);
			}
		}
		return;
	}

	// Check mentions for timezones
	message.mentions.users.forEach(user => {
		const timezone = getUserTimezone(user.id);
		if (timezone && moment.tz(timezone).hours() === 0) message.channel.send(`⚠️ It is past midnight for ${user.username}. Please consider messaging them later.`);
	});
}
