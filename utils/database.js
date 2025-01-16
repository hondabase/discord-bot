import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
	host: 'localhost',
	user: process.env.MYSQL_USER,
	password: process.env.MYSQL_PASSWORD,
	database: 'hondatabase_discordbot'
});

export async function logUserActivity(userId, username, action, details = null) {
	if (!userId || !action) return;
	
	const [result] = await pool.execute(
		'INSERT INTO user_activities (user_id, username, action, details, timestamp) VALUES (?, ?, ?, ?, NOW())',
		[userId, username, action, details]
	);
	
	return result;
}

export async function getSetting(key) {
	const [rows] = await pool.execute('SELECT value FROM bot_settings WHERE `key` = ? LIMIT 1', [key]);
	return rows[0]?.value || null;
}

export async function setSetting(key, value) {
	if (!key || value === undefined) return;
	await pool.execute('INSERT INTO bot_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?', 
		[key, value, value]);
}

export async function getCurrentCommit() {
	return getSetting('commit_hash');
}

export async function updateCommit(hash) {
	return setSetting('commit_hash', hash);
}

// Initialize database and tables
export async function initDatabase() {
	const connection = await mysql.createConnection({
		host: 'localhost',
		user: process.env.MYSQL_USER,
		password: process.env.MYSQL_PASSWORD
	});

	await connection.execute('CREATE DATABASE IF NOT EXISTS hondatabase_discordbot');
	await connection.execute('USE hondatabase_discordbot');
	
	await connection.execute(`
		CREATE TABLE IF NOT EXISTS user_activities (
			id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
			user_id VARCHAR(20) NOT NULL,
			username VARCHAR(255) NOT NULL,
			action VARCHAR(50) NOT NULL,
			details TEXT,
			timestamp DATETIME NOT NULL,
			INDEX idx_user_id (user_id),
			INDEX idx_action (action),
			INDEX idx_timestamp (timestamp)
		)
	`);

	await connection.execute(`
		CREATE TABLE IF NOT EXISTS bot_settings (
			id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
			\`key\` VARCHAR(50) NOT NULL,
			value TEXT,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			UNIQUE KEY idx_key (\`key\`)
		)
	`);

	await connection.end();
}
