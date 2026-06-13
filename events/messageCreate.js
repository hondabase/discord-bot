import moment from 'moment-timezone';
import { PermissionFlagsBits } from 'discord.js';

import { getUserTimezone } from '../handlers/TimezoneHandler.js';
import { STAFF_CHANNEL_ID, STAFF_ROLE_ID } from '../config.js';
import { logUserActivity } from '../utils/database.js';
const INVITE_LINK_REGEX = /(discord\.gg\/|discord\.com\/invite\/)/i;

export async function execute(_, message) {
	if (message.author.bot) return;
	logUserActivity(message.author.id, message.author.username, 'message').catch(error => console.error('Failed to log message activity:', error));
	const isStaffMessage = message.member.roles.cache.has(STAFF_ROLE_ID);

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

	// Check mentions for timezones
	message.mentions.users.forEach(user => {
		const timezone = getUserTimezone(user.id);
		if (timezone && moment.tz(timezone).hours() === 0) message.channel.send(`⚠️ It is past midnight for ${user.username}. Please consider messaging them later.`);
	});
}
