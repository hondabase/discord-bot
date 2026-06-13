import getBlacklist from '../utils/getBlacklist.js';
import { logUserActivity } from '../utils/database.js';
import { STAFF_CHANNEL_ID } from '../config.js';

export async function execute(client, member) {
	const { user, guild } = member;
	const username = user.username;

	let inviter = 'Unknown';
	try {
		const newInvites = await guild.invites.fetch();
		const oldInvites = client.guildInvites.get(guild.id) || new Map();
		const invite     = newInvites.find(i => i.uses > (oldInvites.get(i.code) || 0));

		if (invite) inviter = invite.inviter.tag;

		client.guildInvites.set(guild.id, new Map(newInvites.map(invite => [invite.code, invite.uses])));
	} catch (error) {
		console.error('Error tracking inviter:', error);
	}

	const staffChannel = guild.channels.cache.get(STAFF_CHANNEL_ID);
	staffChannel.send(`👥 **New member** 👥\nUser: **${user}**\nInvited by: **${inviter}**`);

	logUserActivity(user.id, user.username, 'join', { inviter: inviter });

	// Read blacklisted users from file
	const blacklist = await getBlacklist();
	if (blacklist[username]?.active) {
		const reason = blacklist[username].reason || 'No reason provided';

		member.timeout(24 * 60 * 60 * 1000, reason).then(() => console.log(`Timed out ${username} for 24 hours`)).catch(console.error);

		staffChannel.send(`⚠️ **Alert** ⚠️\nUser **${user}** has been timed out for 24 hours. Reason: ${reason}`);

		logUserActivity(user.id, user.username, 'timeout', { reason: reason });
	}
}
