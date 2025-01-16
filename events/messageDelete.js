import { logUserActivity } from '../utils/database.js';

export async function execute(message) {
	if (!message?.author) return; // Ignore partial messages or system messages
	
	logUserActivity(message.author.id, message.author.username, 'delete_message', { content: message.content });
}