import mysql from 'mysql2/promise';
import {
	FILES_MYSQL_DATABASE,
	FILES_MYSQL_HOST,
	FILES_MYSQL_PASSWORD,
	FILES_MYSQL_USER,
	MYSQL_USER,
	MYSQL_PASSWORD,
	SHARED_DISCORD_MYSQL_DATABASE,
	SHARED_DISCORD_MYSQL_HOST,
	SHARED_DISCORD_MYSQL_PASSWORD,
	SHARED_DISCORD_MYSQL_USER,
	HONDABASE_MYSQL_DATABASE,
	HONDABASE_MYSQL_HOST,
	HONDABASE_MYSQL_PASSWORD,
	HONDABASE_MYSQL_USER
} from '../config.js';

const pool = mysql.createPool({
	host: 'localhost',
	user: MYSQL_USER,
	password: MYSQL_PASSWORD,
	database: 'hondatabase_discordbot'
});

const filesPool = FILES_MYSQL_USER && FILES_MYSQL_DATABASE
	? mysql.createPool({
		host: FILES_MYSQL_HOST,
		user: FILES_MYSQL_USER,
		password: FILES_MYSQL_PASSWORD,
		database: FILES_MYSQL_DATABASE,
		connectionLimit: 2
	})
	: null;

export const sharedDiscordPool = mysql.createPool({
	host: SHARED_DISCORD_MYSQL_HOST,
	user: SHARED_DISCORD_MYSQL_USER,
	password: SHARED_DISCORD_MYSQL_PASSWORD,
	database: SHARED_DISCORD_MYSQL_DATABASE,
	connectionLimit: 2
});

const hondabasePool = HONDABASE_MYSQL_USER && HONDABASE_MYSQL_DATABASE
	? mysql.createPool({
		host: HONDABASE_MYSQL_HOST,
		user: HONDABASE_MYSQL_USER,
		password: HONDABASE_MYSQL_PASSWORD,
		database: HONDABASE_MYSQL_DATABASE,
		connectionLimit: 2
	})
	: null;

export async function logUserActivity(userId, username, action, details = null) {
	if (!userId || !action) return;

	const serializedDetails = details === null ? null : JSON.stringify(details);
	const [result] = await pool.execute('INSERT INTO user_activities (user_id, username, action, details, timestamp) VALUES (?, ?, ?, ?, NOW())',[userId, username, action, serializedDetails]);
	
	return result;
}

export async function recordMemberJoin(member) {
	const joinedAt = member.joinedAt || new Date();

	await pool.execute(`
		INSERT INTO member_sessions (user_id, guild_id, username, joined_at)
		SELECT ?, ?, ?, ?
		WHERE NOT EXISTS (
			SELECT 1 FROM member_sessions
			WHERE user_id = ? AND guild_id = ? AND left_at IS NULL
		)
	`, [member.id, member.guild.id, member.user.username, joinedAt, member.id, member.guild.id]);
}

export async function recordMemberLeave(member) {
	const leftAt = new Date();
	const joinedAt = member.joinedAt || leftAt;
	const connection = await pool.getConnection();

	try {
		await connection.beginTransaction();

		const [openSessions] = await connection.execute(`
			SELECT id, joined_at
			FROM member_sessions
			WHERE user_id = ? AND guild_id = ? AND left_at IS NULL
			ORDER BY joined_at DESC
			LIMIT 1
			FOR UPDATE
		`, [member.id, member.guild.id]);

		if (openSessions.length > 0) {
			await connection.execute(`
				UPDATE member_sessions
				SET username = ?, left_at = ?, duration_ms = TIMESTAMPDIFF(MICROSECOND, joined_at, ?) DIV 1000
				WHERE id = ?
			`, [member.user.username, leftAt, leftAt, openSessions[0].id]);
		} else {
			await connection.execute(`
				INSERT INTO member_sessions (user_id, guild_id, username, joined_at, left_at, duration_ms)
				VALUES (?, ?, ?, ?, ?, ?)
			`, [member.id, member.guild.id, member.user.username, joinedAt, leftAt, Math.max(0, leftAt - joinedAt)]);
		}

		const [rows] = await connection.execute(`
			SELECT COUNT(*) AS stay_count, COALESCE(SUM(duration_ms), 0) AS total_duration_ms
			FROM member_sessions
			WHERE user_id = ? AND guild_id = ? AND left_at IS NOT NULL
		`, [member.id, member.guild.id]);

		const [legacyLeaves] = await connection.execute(`
			SELECT details
			FROM user_activities
			WHERE user_id = ? AND action = 'leave'
		`, [member.id]);
		const legacyDurations = legacyLeaves.flatMap(row => {
			try {
				const details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
				return details?.sessionTracked === true || !Number.isFinite(Number(details?.duration))
					? []
					: [Number(details.duration)];
			} catch {
				return [];
			}
		});

		await connection.commit();
		return {
			latestDurationMs: Math.max(0, leftAt - joinedAt),
			stayCount: Number(rows[0].stay_count) + legacyDurations.length,
			totalDurationMs: Number(rows[0].total_duration_ms) + legacyDurations.reduce((total, duration) => total + duration, 0)
		};
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function getUserParticipationSummary(userId) {
	const [counts] = await pool.execute(`
		SELECT
			SUM(action = 'message') AS messages,
			SUM(action = 'reaction') AS reactions,
			SUM(action = 'command') AS commands
		FROM user_activities
		WHERE user_id = ?
	`, [userId]);
	const [commandRows] = await pool.execute(`
		SELECT details
		FROM user_activities
		WHERE user_id = ? AND action = 'command'
	`, [userId]);

	const summary = {
		messages: Number(counts[0].messages || 0),
		reactions: Number(counts[0].reactions || 0),
		commands: Number(counts[0].commands || 0),
		portal: { total: 0, files: 0, pdf: 0, github: 0 }
	};

	for (const row of commandRows) {
		try {
			const details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
			const command = details?.command;
			const isPortalGithubLink = command === 'github' && details?.options?.repository === 'files-archive';

			if (command === 'files' || command === 'pdf' || isPortalGithubLink) {
				summary.portal.total++;
				if (command === 'files') summary.portal.files++;
				if (command === 'pdf') summary.portal.pdf++;
				if (isPortalGithubLink) summary.portal.github++;
			}
		} catch {
			// Older activity details may not be JSON.
		}
	}

	return summary;
}

export async function getFilesPortalParticipation(userId) {
	if (!filesPool) return null;

	try {
		const [[userRows], [uploadRows], [favoriteRows], [editRows], [auditRows]] = await Promise.all([
			filesPool.execute(`
				SELECT created_at, last_login
				FROM users
				WHERE discord_id = ?
			`, [userId]),
			filesPool.execute(`
				SELECT
					COUNT(*) AS total,
					SUM(status = 'approved') AS approved,
					SUM(status = 'pending') AS pending,
					SUM(status = 'rejected') AS rejected
				FROM files
				WHERE uploaded_by = ?
			`, [userId]),
			filesPool.execute(`
				SELECT COUNT(*) AS total
				FROM favorites
				WHERE user_id = ?
			`, [userId]),
			filesPool.execute(`
				SELECT
					COUNT(*) AS total,
					SUM(field = 'title') AS titles,
					SUM(field = 'description') AS descriptions
				FROM edit_history
				WHERE user_id = ?
			`, [userId]),
			filesPool.execute(`
				SELECT
					COUNT(*) AS total,
					SUM(action = 'login') AS logins
				FROM audit_log
				WHERE user_id = ?
			`, [userId])
		]);

		if (userRows.length === 0) return {
			hasAccount: false,
			uploads: { total: 0, approved: 0, pending: 0, rejected: 0 },
			favorites: 0,
			edits: { total: 0, titles: 0, descriptions: 0 },
			actions: 0,
			logins: 0
		};

		return {
			hasAccount: true,
			createdAt: userRows[0].created_at,
			lastLogin: userRows[0].last_login,
			uploads: {
				total: Number(uploadRows[0].total || 0),
				approved: Number(uploadRows[0].approved || 0),
				pending: Number(uploadRows[0].pending || 0),
				rejected: Number(uploadRows[0].rejected || 0)
			},
			favorites: Number(favoriteRows[0].total || 0),
			edits: {
				total: Number(editRows[0].total || 0),
				titles: Number(editRows[0].titles || 0),
				descriptions: Number(editRows[0].descriptions || 0)
			},
			actions: Number(auditRows[0].total || 0),
			logins: Number(auditRows[0].logins || 0)
		};
	} catch (error) {
		console.error('Failed to read Files Portal participation:', error);
		return null;
	}
}

export async function getSetting(key) {
	const [rows] = await pool.execute('SELECT value FROM bot_settings WHERE `key` = ? LIMIT 1', [key]);
	return rows[0]?.value || null;
}

export async function setSetting(key, value) {
	if (!key || value === undefined) return;
	await pool.execute('INSERT INTO bot_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?', [key, value, value]);
}

export const getCurrentCommit = () => getSetting('commit_hash');

export const updateCommit = (hash) => setSetting('commit_hash', hash);

// Initialize database and tables
export async function initDatabase() {
	const connection = await mysql.createConnection({
		host: 'localhost',
		user: MYSQL_USER,
		password: MYSQL_PASSWORD
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

	await connection.execute(`
		CREATE TABLE IF NOT EXISTS member_sessions (
			id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
			user_id VARCHAR(20) NOT NULL,
			guild_id VARCHAR(20) NOT NULL,
			username VARCHAR(255) NOT NULL,
			joined_at DATETIME(3) NOT NULL,
			left_at DATETIME(3),
			duration_ms BIGINT UNSIGNED,
			INDEX idx_member_sessions_user_guild (user_id, guild_id),
			INDEX idx_member_sessions_open (guild_id, left_at),
			UNIQUE KEY idx_member_sessions_unique_join (user_id, guild_id, joined_at)
		)
	`);

	await connection.end();
}

export async function getArticleCount() {
	if (!hondabasePool) return 0;
	try {
		const [rows] = await hondabasePool.execute('SELECT COUNT(*) AS count FROM articles');
		return Number(rows[0]?.count || 0);
	} catch (error) {
		console.error('Failed to get article count:', error);
		return 0;
	}
}

const STOPWORDS = new Set([
	'what', 'how', 'why', 'who', 'which', 'where', 'when',
	'the', 'this', 'that', 'these', 'those', 'they', 'them',
	'and', 'but', 'for', 'with', 'from', 'out', 'into',
	'about', 'there', 'their', 'here', 'your', 'ours',
	'have', 'has', 'had', 'was', 'were', 'been', 'being',
	'does', 'did', 'done', 'doing', 'will', 'would', 'shall',
	'should', 'can', 'could', 'may', 'might', 'must',
	'some', 'any', 'all', 'none', 'both', 'each', 'every',
	'other', 'another', 'such', 'than', 'then', 'thus',
	'you', 'your', 'yours', 'him', 'her', 'its', 'their', 'theirs',
	'are', 'was', 'were', 'have', 'has', 'had', 'been'
]);

export function extractKeywords(text) {
	if (!text) return [];
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, '')
		.split(/\s+/)
		.map(w => w.trim())
		.filter(w => w.length > 2 && !STOPWORDS.has(w));
}

export async function searchKnowledge(queryText) {
	const results = {
		article: null,
		files: []
	};

	if (!queryText || typeof queryText !== 'string') return results;
	const keywords = extractKeywords(queryText);
	
	// If no valid keywords (only stopwords/short words), short-circuit immediately
	if (keywords.length === 0) return results;

	const cleanQuery = keywords.join(' ');

	// 1. Search hondabasePool articles using FULLTEXT match
	if (hondabasePool) {
		try {
			const [rows] = await hondabasePool.execute(`
				SELECT title, summary, body_text,
				       MATCH(title, summary, body_text) AGAINST(? IN NATURAL LANGUAGE MODE) AS score
				FROM articles
				WHERE MATCH(title, summary, body_text) AGAINST(? IN NATURAL LANGUAGE MODE)
				ORDER BY score DESC
				LIMIT 1
			`, [cleanQuery, cleanQuery]);
			if (rows.length > 0 && rows[0].score > 0) {
				results.article = rows[0];
			}
		} catch (error) {
			console.error('Failed to search articles:', error);
		}
	}

	// 2. Search filesPool files using keyword LIKE matching
	if (filesPool) {
		try {
			const searchKeywords = keywords.slice(0, 5); // limit to 5 keywords
			const conditions = [];
			const params = [];
			for (const keyword of searchKeywords) {
				conditions.push(`(name LIKE ? OR display_name LIKE ? OR description LIKE ?)`);
				const pattern = `%${keyword}%`;
				params.push(pattern, pattern, pattern);
			}
			const query = `
				SELECT name, display_name, description
				FROM files
				WHERE status = 'approved' AND (${conditions.join(' OR ')})
				LIMIT 3
			`;
			const [rows] = await filesPool.execute(query, params);
			results.files = rows;
		} catch (error) {
			console.error('Failed to search files:', error);
		}
	}

	return results;
}
