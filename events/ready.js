import { ActivityType } from "discord.js";
import { ARTICLE_REQUEST_CHANNEL_ID } from '../config.js';
import setupArticleRequestCollectors from '../utils/articleRequestCollectors.js';
import { checkVersion } from '../utils/versionCheck.js';

export const name = 'ready';
export async function execute(client) {
	console.log(`Ready! Logged in as ${client.user.tag}`);
	
	await checkVersion(client);
	
	client.user.setPresence({ activities: [{ name: 'We currently have 4 articles.', type: ActivityType.Custom }], status: 'online' });

	// Fetch invites
	client.guilds.cache.forEach(guild => {
		guild.invites.fetch()
			.then(invites => client.guildInvites.set(guild.id, new Map(invites.map(invite => [invite.code, invite.uses]))))
			.catch(error => console.error(`Failed to fetch invites for guild ${guild.id}:`, error));
	});

	// Setup collectors for existing article requests
	const articleRequestChannel = client.channels.cache.get(ARTICLE_REQUEST_CHANNEL_ID);
	if (articleRequestChannel) {
		await setupArticleRequestCollectors(articleRequestChannel);
	} else {
		console.error('Article request channel not found');
	}
}
