import formatDuration from '../utils/formatDuration.js';
import { STAFF_CHANNEL_ID } from '../config.js';
import { logUserActivity } from '../utils/database.js';

export async function execute(client, member) {
	const { user, guild, joinedAt } = member;
	const staffChannel = guild.channels.cache.get(STAFF_CHANNEL_ID);
	const duration = Date.now() - joinedAt;
	
	staffChannel.send(`👋 **Member left** 👋\nUsername: **${user.username}**\nStayed for: **${formatDuration(duration)}**`);

	logUserActivity(user.id, user.username, 'leave', { duration: duration });
}