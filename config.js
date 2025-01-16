import dotenv from 'dotenv';
dotenv.config();

export const BOT_CLIENT_ID = process.env.BOT_CLIENT_ID
export const BOT_TOKEN = process.env.BOT_TOKEN
export const INVITE_URL = "http://discord.hondatabase.com"
export const STAFF_CHANNEL_ID = process.env.STAFF_CHANNEL_ID
export const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID
export const HANGOUT_CHANNEL_ID = process.env.HANGOUT_CHANNEL_ID
export const ARTICLE_REQUEST_CHANNEL_ID = process.env.ARTICLE_REQUEST_CHANNEL_ID
export const ARTICLE_REQUEST_CHANNEL_TOPARTICLES_MESSAGE_ID = process.env.ARTICLE_REQUEST_CHANNEL_TOPARTICLES_MESSAGE_ID
export const GITHUB_ORG_URL = "https://github.com/hondatabase/"

export const MYSQL_USER = process.env.MYSQL_USER
export const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD

export const WATCHDOG_WEBHOOK_URL = process.env.WATCHDOG_WEBHOOK_URL
