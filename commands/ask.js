import { SlashCommandBuilder } from 'discord.js';
import { isAuthorized, queryOllama, splitMessage, startLoadingAnimation } from '../handlers/AiHandler.js';

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

    // Fetch the placeholder reply to animate
    const statusMsg = await interaction.fetchReply();
    const anim = startLoadingAnimation(statusMsg, '⏳ Enqueued');

    try {
        const messages = [{ role: 'user', content: prompt }];
        
        // Callback to handle real-time queue updates
        const onQueueUpdate = async (pos, isProcessing) => {
            try {
                if (isProcessing) {
                    anim.updateText('✍️ Soichiro is thinking');
                } else {
                    anim.updateText(`⏳ Enqueued. Position in queue: ${pos}`);
                }
            } catch (err) {
                // Fail silently
            }
        };

        const responseText = await queryOllama(messages, onQueueUpdate);
        anim.stop();

        const chunks = splitMessage(responseText);
        
        // Update the deferred reply with the first chunk
        await interaction.editReply({ content: chunks[0] });

        // Send any remaining chunks as follow-up messages
        for (let i = 1; i < chunks.length; i++) {
            await interaction.followUp({ content: chunks[i] });
        }
    } catch (error) {
        console.error('Error in ask slash command:', error);
        anim.stop();
        await interaction.editReply({ 
            content: 'Sorry, I encountered an error while processing your request.' 
        });
    }
}
