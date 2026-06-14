import { SlashCommandBuilder } from 'discord.js';
import { isAuthorized, queryOllama, splitMessage } from '../handlers/AiHandler.js';

export const data = new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask Soichiro, the Hondabase+ AI assistant, a question.')
    .addStringOption(option => 
        option.setName('prompt')
            .setDescription('Your question for the AI assistant')
            .setRequired(true)
    );

export async function execute(interaction) {
    const member = interaction.member;
    
    // Authorization check
    if (!isAuthorized(member)) {
        return await interaction.reply({ 
            content: '❌ You must have the `Hondabase+` role to use the AI assistant.', 
            ephemeral: true 
        });
    }

    const prompt = interaction.options.getString('prompt');

    // Defer the reply since Ollama can take a few seconds
    await interaction.deferReply();

    try {
        const messages = [{ role: 'user', content: prompt }];
        
        // Callback to handle real-time queue updates
        const onQueueUpdate = async (pos, isProcessing) => {
            try {
                if (isProcessing) {
                    await interaction.editReply({ content: '✍️ Soichiro is thinking...' });
                } else {
                    await interaction.editReply({ content: `⏳ Enqueued. Position in queue: ${pos}. Please wait...` });
                }
            } catch (err) {
                // Fail silently if interaction was deleted
            }
        };

        const responseText = await queryOllama(messages, onQueueUpdate);
        const chunks = splitMessage(responseText);
        
        // Update the deferred reply with the first chunk
        await interaction.editReply({ content: chunks[0] });

        // Send any remaining chunks as follow-up messages
        for (let i = 1; i < chunks.length; i++) {
            await interaction.followUp({ content: chunks[i] });
        }
    } catch (error) {
        console.error('Error in ask slash command:', error);
        await interaction.editReply({ 
            content: 'Sorry, I encountered an error while processing your request.' 
        });
    }
}
