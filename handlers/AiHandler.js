import { PermissionFlagsBits } from 'discord.js';
import { OLLAMA_MODEL, OLLAMA_API_URL, STAFF_ROLE_ID } from '../config.js';
import { searchKnowledge } from '../utils/database.js';
import { ollamaQueue } from '../utils/ollamaQueue.js';

/**
 * Checks if a member is authorized to use AI features.
 * Authorized if they have the 'Hondabase+' role, 'Staff' role, or Admin permissions.
 */
export function isAuthorized(member) {
    if (!member) return false;
    
    // Admins are always authorized
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
    }

    // Staff are authorized
    if (STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID)) {
        return true;
    }

    // Hondabase+ members are authorized
    return member.roles.cache.some(role => role.name === 'Hondabase+');
}

/**
 * Splits a text string into chunks of up to `limit` characters without cutting off lines.
 */
export function splitMessage(text, limit = 2000) {
    const chunks = [];
    let currentChunk = '';
    const lines = text.split('\n');
    for (const line of lines) {
        if (currentChunk.length + line.length + 1 > limit) {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = line;
        } else {
            currentChunk = currentChunk ? currentChunk + '\n' + line : line;
        }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
}

/**
 * Queries Ollama with a set of messages.
 */
export async function queryOllama(messages, onQueueUpdate) {
    const userMessages = messages.filter(m => m.role === 'user');
    // Always use the first user message in the conversation as the RAG query to maintain topic context
    const firstQuery = userMessages.length > 0 ? userMessages[0].content : '';
    
    // Search database
    const searchResults = await searchKnowledge(firstQuery);
    
    // Short circuit if no articles and no files are found
    if (!searchResults.article && (!searchResults.files || searchResults.files.length === 0)) {
        return "I'm sorry, but I do not have information on that topic in our manuals or articles.";
    }

    // Format context
    let formattedContext = '';
    if (searchResults.article) {
        formattedContext += `--- ARTICLE ---\nTitle: ${searchResults.article.title}\nSummary: ${searchResults.article.summary}\nBody:\n${searchResults.article.body_text}\n\n`;
    }
    if (searchResults.files && searchResults.files.length > 0) {
        formattedContext += `--- RELATED MANUALS / FILES ---\n`;
        searchResults.files.forEach(file => {
            formattedContext += `- File: ${file.display_name || file.name} (${file.name})\n  Description: ${file.description || 'No description provided.'}\n`;
        });
    }

    const systemPrompt = {
        role: 'system',
        content: `You are Soichiro, a friendly, helpful, and concise technical assistant for Hondabase.
You must answer the user's questions SOLELY based on the manuals and articles provided below in the Context.
If the answer cannot be found in the provided Context, you must politely respond: "I'm sorry, but I do not have information on that topic in our manuals or articles."
Do not make up facts or use external knowledge not present in the provided manuals or articles.
Always format your response using clean Discord Markdown (use bolding, headers, lists, and tables/code blocks where appropriate).

Context:
${formattedContext}`
    };

    const payload = {
        model: OLLAMA_MODEL,
        messages: [systemPrompt, ...messages],
        stream: false
    };

    try {
        const responseText = await ollamaQueue.enqueue(async () => {
            const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.message?.content || 'Sorry, I could not generate a response.';
        }, onQueueUpdate);
        return responseText;
    } catch (error) {
        console.error('Error querying Ollama:', error);
        return 'Sorry, I encountered an error communicating with my AI backend.';
    }
}

/**
 * Generates a short thread title based on the prompt.
 */
export async function generateThreadTitle(userPrompt, botReply) {
    const promptText = `Generate a short 3-5 word title for a Discord chat thread based on this initial Q&A. Do not use quotes, markdown, or extra explanations. Only output the raw title.\n\nUser: ${userPrompt}\nSoichiro: ${botReply}`;
    
    try {
        const titleText = await ollamaQueue.enqueue(async () => {
            const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: OLLAMA_MODEL,
                    prompt: promptText,
                    stream: false
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama generate error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.response?.trim() || 'Hondabase+ AI Chat';
        });

        // Clean up title (remove markdown quotes)
        let title = titleText.replace(/^["']|["']$/g, '').trim();
        if (title.length > 50) title = title.substring(0, 47) + '...';
        
        return title;
    } catch (error) {
        console.error('Error generating thread title:', error);
        return 'Hondabase+ AI Conversation';
    }
}

/**
 * Starts a text animation with a moving ellipsis (...) on a Discord message.
 */
export function startLoadingAnimation(statusMsg, initialStatusText) {
    let baseText = initialStatusText;
    let dots = 1;

    const interval = setInterval(async () => {
        dots = (dots % 3) + 1;
        const ellipsis = '.'.repeat(dots);
        try {
            await statusMsg.edit(`${baseText}${ellipsis}`);
        } catch (err) {
            // Clear if message gets deleted or edited externally
            clearInterval(interval);
        }
    }, 1000);

    return {
        updateText: (newText) => {
            baseText = newText;
        },
        stop: () => {
            clearInterval(interval);
        }
    };
}

export async function handleThreadMessage(client, message) {
    const statusMsg = await message.channel.send('⏳ Enqueued.');
    const anim = startLoadingAnimation(statusMsg, '⏳ Enqueued.');

    try {
        // Fetch last 50 messages to construct context
        const threadMessages = await message.channel.messages.fetch({ limit: 50 });
        
        // Sort messages chronologically and map to Ollama chat roles
        const sorted = [...threadMessages.values()]
            .filter(msg => !msg.system && msg.content)
            .reverse();
        
        const chatMessages = sorted.map(msg => {
            const role = msg.author.id === client.user.id ? 'assistant' : 'user';
            
            // For users, strip out any bot mentions
            let content = msg.content;
            if (role === 'user') {
                content = content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
            }
            
            return { role, content };
        });

        // Callback to handle real-time queue updates
        const onQueueUpdate = async (pos, isProcessing) => {
            try {
                if (isProcessing) {
                    anim.updateText('✍️ Soichiro is thinking');
                    await message.channel.sendTyping().catch(() => {});
                } else {
                    anim.updateText(`⏳ Enqueued. Position in queue: ${pos}`);
                }
            } catch (err) {
                // Fail silently if message is deleted
            }
        };

        const replyText = await queryOllama(chatMessages, onQueueUpdate);
        anim.stop();

        const chunks = splitMessage(replyText);

        await statusMsg.edit(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
            await message.channel.send(chunks[i]);
        }
    } catch (error) {
        console.error('Error handling thread message:', error);
        anim.stop();
        try {
            await statusMsg.edit('An error occurred while continuing the conversation.');
        } catch (e) {
            await message.channel.send('An error occurred while continuing the conversation.');
        }
    }
}
