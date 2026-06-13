import { SlashCommandBuilder } from 'discord.js';
import { GITHUB_ORG_URL } from '../config.js';

export const data = new SlashCommandBuilder()
    .setName('github')
    .setDescription('Provides GitHub repository information')
    .addStringOption(option => option.setName('repository')
        .setDescription('Choose which GitHub repository you want the URL for.')
        .setRequired(true)
        .addChoices(
            { name: 'Discord Bot', value: 'discord-bot' },
            { name: 'Website', value: 'website' },
            { name: 'Files Archive', value: 'files-archive' },
            { name: 'Vehicle Content', value: 'vehicle-content' }
        ));
export async function execute(interaction) {
    const repository = interaction.options.getString('repository');
    let repoName, description;

    switch (repository) {
        case 'discord-bot':
            repoName = 'discord-bot';
            description = 'Repository for our Discord bot code';
            break;
        case 'website':
            repoName = 'hondabase.com';
            description = 'Repository for our main website hondabase.com';
            break;
        case 'files-archive':
            repoName = 'files-archive';
            description = 'Repository for our files archive';
            break;
        case 'vehicle-content':
            repoName = 'vehicle-content';
            description = 'Repository for our vehicle content data';
            break;
    }

    await interaction.reply(`${description}\nGitHub Repository: ${GITHUB_ORG_URL + repoName}`);
}
