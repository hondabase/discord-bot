import { logUserActivity } from '../utils/database.js';

export async function execute(client, interaction) {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
        logUserActivity(interaction.user.id, interaction.user.username, 'command', {
            command: command.data.name,
            options: Object.fromEntries(interaction.options.data.map(option => [option.name, option.value]))
        }).catch(error => console.error('Failed to log command activity:', error));
        console.log(`${interaction.user.tag} executed command ${command.data.name}`);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error executing that command!', ephemeral: true });
    }
}
