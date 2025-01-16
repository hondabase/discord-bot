import { Octokit } from 'octokit';
import { getCurrentCommit, updateCommit } from './database.js';
import { HANGOUT_CHANNEL_ID, GITHUB_ORG_URL } from '../config.js';

export async function checkVersion(client) {
	try {
		const response = await new Octokit().request('GET /repos/hondatabase/discord-bot/commits/main', { owner: 'hondatabase', repo: 'discord-bot' });

		const latestCommit = response.data.sha;
		const currentCommit = await getCurrentCommit();
		
		if (!currentCommit || currentCommit !== latestCommit) {
			const channel = client.channels.cache.get(HANGOUT_CHANNEL_ID);
			if (!channel) return;

			channel.send(`I'm back and better baby! 🚀\nCheck out the latest changes: ${GITHUB_ORG_URL}discord-bot/commits/main`);
			
			await updateCommit(latestCommit);
		}
	} catch (error) {
		console.error('Failed to check version:', error);
	}
}
