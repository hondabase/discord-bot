import { ActivityType } from "discord.js";
import { ARTICLE_REQUEST_CHANNEL_ID } from '../config.js';
import setupArticleRequestCollectors from '../utils/articleRequestCollectors.js';
import { recordMemberJoin } from '../utils/database.js';

export const name = 'ready';
export async function execute(client) {
	console.log(`Ready! Logged in as ${client.user.tag}`);
	
	client.user.setPresence({ activities: [{ name: 'We currently have 4 articles.', type: ActivityType.Custom }], status: 'online' });

	// Fetch invites
	for (const guild of client.guilds.cache.values()) {
		guild.invites.fetch()
			.then(invites => client.guildInvites.set(guild.id, new Map(invites.map(invite => [invite.code, invite.uses]))))
			.catch(error => console.error(`Failed to fetch invites for guild ${guild.id}:`, error));

		try {
			const members = await guild.members.fetch();
			await Promise.all(members.filter(member => !member.user.bot).map(member => recordMemberJoin(member)));
		} catch (error) {
			console.error(`Failed to initialize member sessions for guild ${guild.id}:`, error);
		}
	}

	// Setup collectors for existing article requests
	const articleRequestChannel = client.channels.cache.get(ARTICLE_REQUEST_CHANNEL_ID);
	if (articleRequestChannel) {
		await setupArticleRequestCollectors(articleRequestChannel);
	} else {
		console.error('Article request channel not found');
	}
}
