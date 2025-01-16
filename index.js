import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { readdirSync } from 'fs';
import { BOT_TOKEN } from './config.js';
import { initDatabase } from './utils/database.js';

export const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
    ],
    partials: ["MESSAGE", "CHANNEL", "REACTION", "GUILD_MEMBER"]
});

client.commands     = new Collection();
client.guildInvites = new Collection();

// Prevent crashing
process.on('unhandledRejection', error => console.error('Unhandled promise rejection:', error));
process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

const loadCommands = async () => {
    try {
        const commandFiles = readdirSync('./commands').filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = await import(`./commands/${file}`).catch(console.error);
            if (!command) continue;
            
            client.commands.set(file.split('.')[0], command);
        }
    } catch (error) {
        console.error('Failed to load commands:', error);
        process.exit(1);
    }
};

const loadEvents = async () => {
    try {
        const eventFiles = readdirSync('./events').filter(file => file.endsWith('.js'));
        for (const file of eventFiles) {
            const event = await import(`./events/${file}`).catch(console.error);
            if (!event) continue;

            const eventName = file.split('.')[0];
            client.on(eventName, (...args) => event.execute(client, ...args));
        }
    } catch (error) {
        console.error('Failed to load events:', error);
        process.exit(1);
    }
};

(async () => {
    try {
        await initDatabase();
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    }

    await loadCommands();
    await loadEvents();
    await client.login(BOT_TOKEN).catch(error => {
        console.error('Failed to login:', error);
        process.exit(1);
    });
})();
