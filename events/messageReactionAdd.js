import { promises as fs } from 'fs';
import { join } from 'path';
import { ARTICLE_REQUEST_CHANNEL_ID, ARTICLE_REQUEST_CHANNEL_TOPARTICLES_MESSAGE_ID } from '../config.js';
import { logUserActivity } from '../utils/database.js';

export async function execute(_, reaction, user) {
    if (user.bot) return;
    logUserActivity(user.id, user.username, 'reaction').catch(error => console.error('Failed to log reaction activity:', error));

    // Check if it's a partial reaction
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error fetching reaction:', error);
            return;
        }
    }

    // Reactions in the Article Request channel
    if (reaction.message.channel.id === ARTICLE_REQUEST_CHANNEL_ID) {
        if (reaction.emoji.name === '👍') { // We only care about the like reaction
            const filePath = join(__dirname, '..', 'data', 'articles.json');
            try {
                const data = await fs.readFile(filePath, 'utf8');
                let articles = JSON.parse(data);

                const article = articles.find(a => a.id === reaction.message.id);
                if (article) {
                    article.likes = reaction.count;
                    await fs.writeFile(filePath, JSON.stringify(articles, null, 2));
                }
            } catch (error) {
                console.error('Error updating article likes:', error);
            }

            // Edit the "Top Articles" message, with the current top 5 articles
            const topArticlesMessage = await reaction.message.channel.messages.fetch(ARTICLE_REQUEST_CHANNEL_TOPARTICLES_MESSAGE_ID);
            if (topArticlesMessage) {
                try {
                    const data = await fs
                        .readFile(filePath, 'utf8')
                        .catch(() => '[]');
                    const articles = JSON.parse(data);
                    const topArticles = articles
                        .filter(a => a.active)
                        .sort((a, b) => b.likes - a.likes)
                        .slice(0, 5)
                        .map(a => `• '${a.description}' (${a.likes} likes)`);
                    await topArticlesMessage.edit(`📚 **Top Articles** 📚\n${topArticles.join('\n')}\n\nUpdated: ${new Date().toLocaleDateString()} `);
                } catch (error) {
                    console.error('Error updating top articles:', error);
                }
            }
        } else {
            try {
                await reaction.remove();
            } catch (error) {
                console.error('Error removing non-like reaction:', error);
            }
        }
    }
}
