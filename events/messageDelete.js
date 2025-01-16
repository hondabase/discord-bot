export async function execute(message) {
	// TODO: Check if the id of this message is one of article requests
	logUserActivity(message.author.id, message.author.username, 'message', { message: message.content });
}