/*
	This command is responsible for searching for PDF files on the "pdf-manuals" GitHub repository (hondatabase/pdf-manuals)
	..and sending a list of matches to the user
*/

import path from 'path';
import { Octokit } from '@octokit/rest';
import { SlashCommandBuilder } from 'discord.js';

import { client } from '../index.js';
import { GITHUB_ORG_URL } from '../config.js';

let pdfFiles = [];

async function fetchPDFFiles(path = '') {
	try {
		const { data } = await new Octokit().repos.getContent({ owner: 'hondatabase', repo: 'pdf-manuals', path });

		let files = [];

		for (const item of data) {

			if (item.type === 'file' && item.name.endsWith('.pdf')) {
				files.push(item.path);
			} else if (item.type === 'dir') {
				const moarFiles = await fetchPDFFiles(item.path);
				files = files.concat(moarFiles);
			}
		}

		return files;
	} catch {
		return [];
	}
}

export const data = new SlashCommandBuilder()
	.setName('pdf')
	.setDescription('Searches for a PDF file on the "pdf-manuals" GitHub repository.')
	.addStringOption(option => option.setName('query')
		.setDescription('The search query')
		.setRequired(true)
	);
export async function execute(interaction) {
	const query = interaction.options.getString('query').toLowerCase().split(' ');

	if (pdfFiles.length === 0) return interaction.reply({ content: 'I currently don\'t have access to GitHub. Try again later.', ephemeral: true });

	const matches = pdfFiles.filter(file => query.every(word => file.toLowerCase().includes(word)));

	if (matches.length === 0) return interaction.reply({ content: 'No matches found.', ephemeral: true });

	const fileList = matches.map(filePath => `[${path.basename(filePath).split('.')[0]}](${GITHUB_ORG_URL}pdf-manuals/raw/main/${filePath.replace(/ /g, '%20')})`).join('\n');
	const prefix   = `**PDFs that match**: \`${query.join(' ')}\`\n`;

	if (prefix.length + fileList.length > 2000) return interaction.reply({ content: 'Too many matches found. Please refine your search.', ephemeral: true });

	await interaction.reply(prefix + fileList);
}

client.on('ready', () => {
	console.log('Fetching PDF files...');
	fetchPDFFiles()
		.then(files => {
			pdfFiles = files;
			console.log(files.length + ' PDF files fetched.');
		})
		.catch(() => console.log('Failed to fetch PDF files.'));
});