import { SlashCommandBuilder } from '@discordjs/builders';
import { promises as fs } from 'fs';
import { join } from 'path';
import { STAFF_CHANNEL_ID, ARTICLE_REQUEST_CHANNEL_ID } from '../config.js';

export const data = new SlashCommandBuilder()
    .setName('request-article')
    .setDescription('Request a new article')
    .addStringOption(option => option.setName('category')
        .setDescription('The category of the article')
        .setRequired(true)
        .addChoices(
            { name: 'Cars', value: 'cars' },
            { name: 'Bikes', value: 'bikes' },
            { name: 'Planes', value: 'planes' }
        ))
    .addStringOption(option => option.setName('description')
        .setDescription('A description of the requested article')
        .setRequired(true));
export async function execute(interaction) {
    const category = interaction.options.getString('category');
    const description = interaction.options.getString('description');
    const requester = interaction.user;

    const staffChannel = interaction.client.channels.cache.get(STAFF_CHANNEL_ID);
    if (!staffChannel) return interaction.reply({ content: 'Error: Staff channel not found.', ephemeral: true });

    const staffMessage = await staffChannel.send(`New article request from **${requester}**:\n**Category**: ${category}\n**Description**: ${description}.`);

    await staffMessage.react('✅');
    await staffMessage.react('❌');

    await interaction.reply({ content: 'Your article request has been submitted for approval.', ephemeral: true });

    // Set up a collector for the staff's reaction
    const filter = (reaction, user) => ['✅', '❌'].includes(reaction.emoji.name) && !user.bot;
    const collector = staffMessage.createReactionCollector({ filter, max: 1, time: 24 * 60 * 60 * 1000 }); // 24 hours

    collector.on('collect', async (reaction, user) => {
        if (reaction.emoji.name === '✅') {
            const articleRequestChannel = interaction.client.channels.cache.get(ARTICLE_REQUEST_CHANNEL_ID);
            if (!articleRequestChannel) return staffChannel.send('Error: Article request channel not found.');

            const requestMessage = await articleRequestChannel.send(`New article request:\nCategory: ${category}\nDescription: ${description}\nRequested by: ${requester}`);
            await requestMessage.react('👍');

            // Save to data/articles.json
            await saveArticleRequest({
                id: requestMessage.id,
                category,
                description,
                requester: requester.username,
                likes: 0,
                active: true,
                assignedTo: [],
                dateRequested: new Date().toISOString()
            });

            staffMessage.reply(`Article request approved by ${user}`);
            interaction.followUp({ content: `Your article request for '${description}' has been approved and posted.`, ephemeral: true });
        } else {
            staffMessage.reply(`Article request rejected by ${user}.`);
            interaction.followUp({ content: `Your article request for '${description}' has been rejected.`, ephemeral: true });
        }

        staffMessage.reactions.removeAll();
    });

    collector.on('end', collected => {
        if (collected.size === 0) staffChannel.send(`No decision was made on the article request from ${requester} within 24 hours.`);
    });
}

async function saveArticleRequest(articleData) {
    const filePath = join(process.cwd(), 'data', 'articles.json');
    try {
        let articles = [];
        try {
            const data = await fs.readFile(filePath, 'utf8');
            articles = JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        articles.push(articleData);
        await fs.writeFile(filePath, JSON.stringify(articles, null, 2));
    } catch (error) {
        console.error('Error saving article request:', error);
    }
}
