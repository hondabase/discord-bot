import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('files')
    .setDescription('Replies with the URL for our Files Archive (contains mostly legacy files).');
export async function execute(interaction) {
    await interaction.reply("Here's the link for the File Archive: https://files.hondabase.com");
}
