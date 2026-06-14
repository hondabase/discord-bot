import dotenv from 'dotenv';
dotenv.config();

export const BOT_CLIENT_ID = process.env.BOT_CLIENT_ID
export const BOT_TOKEN = process.env.BOT_TOKEN
export const INVITE_URL = "https://discord.hondabase.com"
export const STAFF_CHANNEL_ID = process.env.STAFF_CHANNEL_ID
export const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID
export const HANGOUT_CHANNEL_ID = process.env.HANGOUT_CHANNEL_ID
export const ARTICLE_REQUEST_CHANNEL_ID = process.env.ARTICLE_REQUEST_CHANNEL_ID
export const ARTICLE_REQUEST_CHANNEL_TOPARTICLES_MESSAGE_ID = process.env.ARTICLE_REQUEST_CHANNEL_TOPARTICLES_MESSAGE_ID
export const GITHUB_ORG_URL = "https://github.com/hondabase/"

export const MYSQL_USER = process.env.MYSQL_USER
export const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD
export const SHARED_DISCORD_MYSQL_HOST = process.env.SHARED_DISCORD_MYSQL_HOST || 'localhost'
export const SHARED_DISCORD_MYSQL_USER = process.env.SHARED_DISCORD_MYSQL_USER || MYSQL_USER
export const SHARED_DISCORD_MYSQL_PASSWORD = process.env.SHARED_DISCORD_MYSQL_PASSWORD || MYSQL_PASSWORD
export const SHARED_DISCORD_MYSQL_DATABASE = process.env.SHARED_DISCORD_MYSQL_DATABASE || 'discord'
export const FILES_MYSQL_HOST = process.env.FILES_MYSQL_HOST || 'localhost'
export const FILES_MYSQL_USER = process.env.FILES_MYSQL_USER || MYSQL_USER
export const FILES_MYSQL_PASSWORD = process.env.FILES_MYSQL_PASSWORD || MYSQL_PASSWORD
export const FILES_MYSQL_DATABASE = process.env.FILES_MYSQL_DATABASE || 'hondabase_files'

export const HONDABASE_MYSQL_HOST = process.env.HONDABASE_MYSQL_HOST || 'localhost'
export const HONDABASE_MYSQL_USER = process.env.HONDABASE_MYSQL_USER || MYSQL_USER
export const HONDABASE_MYSQL_PASSWORD = process.env.HONDABASE_MYSQL_PASSWORD || MYSQL_PASSWORD
export const HONDABASE_MYSQL_DATABASE = process.env.HONDABASE_MYSQL_DATABASE || 'hondabase'

export const WATCHDOG_WEBHOOK_URL = process.env.WATCHDOG_WEBHOOK_URL
