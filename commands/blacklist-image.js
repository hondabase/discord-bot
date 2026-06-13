import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addImageFingerprint, generateFingerprint, removeImageFingerprint } from '../utils/imageFingerprints.js';

export const data = new SlashCommandBuilder()
	.setName('blacklist-image')
	.setDescription('Manages an image in the shared Discord blacklist.')
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
	.addStringOption(option => option
		.setName('url')
		.setDescription('Public URL of the image.')
		.setRequired(true))
	.addStringOption(option => option
		.setName('action')
		.setDescription('Whether to add or remove the image.')
		.addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }))
	.addStringOption(option => option
		.setName('reason')
		.setDescription('Reason for blocking the image.'));

export async function execute(interaction) {
	const url = interaction.options.getString('url');
	const action = interaction.options.getString('action') || 'add';
	const reason = interaction.options.getString('reason');

	await interaction.deferReply({ ephemeral: true });

	try {
		const fingerprint = await generateFingerprint(url);

		if (action === 'remove') {
			const removed = await removeImageFingerprint(fingerprint);
			await interaction.editReply(removed
				? `Image removed from the shared blacklist.\n**Fingerprint:** \`${fingerprint}\``
				: 'This image was not in the shared blacklist.');
			return;
		}

		await addImageFingerprint(fingerprint, url, interaction.user.id, reason);
		await interaction.editReply(`Image added to the shared blacklist.\n**Fingerprint:** \`${fingerprint}\`${reason ? `\n**Reason:** ${reason}` : ''}`);
	} catch (error) {
		console.error('Failed to manage image blacklist:', error);
		await interaction.editReply(`Failed to process the image: \`${error.message}\``);
	}
}
