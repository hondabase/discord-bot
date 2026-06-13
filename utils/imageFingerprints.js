import { imageHash } from 'image-hash';
import { sharedDiscordPool } from './database.js';

const SIMILARITY_THRESHOLD = 8;
const IMAGE_URL_REGEX = /https?:\/\/[^\s<>]+\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s<>]+)?/gi;

function splitHex(hex) {
	if (!hex || hex.length !== 64) {
		throw new Error('Invalid fingerprint length (must be 256 bits / 64 hex chars)');
	}

	return [hex.slice(0, 16), hex.slice(16, 32), hex.slice(32, 48), hex.slice(48, 64)];
}

async function downloadImage(url) {
	const response = await fetch(url, {
		headers: { 'User-Agent': 'Hondabase Discord Bot' },
		signal: AbortSignal.timeout(30000)
	});

	if (!response.ok) {
		const error = new Error(`Failed to download image: HTTP ${response.status}`);
		error.statusCode = response.status;
		throw error;
	}

	return Buffer.from(await response.arrayBuffer());
}

export async function generateFingerprint(url) {
	const buffer = await downloadImage(url);

	return new Promise((resolve, reject) => {
		imageHash({ data: buffer }, 16, true, (error, fingerprint) => {
			if (error) reject(error);
			else resolve(fingerprint.toLowerCase());
		});
	});
}

export async function addImageFingerprint(fingerprint, url, addedBy, reason = null) {
	const normalized = fingerprint.toLowerCase();
	const [h1, h2, h3, h4] = splitHex(normalized);
	const [result] = await sharedDiscordPool.execute(`
		INSERT INTO image_fingerprints (h1, h2, h3, h4, original_hex, original_url, added_by, reason)
		VALUES (CONV(?, 16, 10), CONV(?, 16, 10), CONV(?, 16, 10), CONV(?, 16, 10), ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE original_url = VALUES(original_url), added_by = VALUES(added_by), reason = VALUES(reason)
	`, [h1, h2, h3, h4, normalized, url, addedBy, reason]);

	return result.affectedRows > 0;
}

export async function removeImageFingerprint(fingerprint) {
	const [result] = await sharedDiscordPool.execute(
		'DELETE FROM image_fingerprints WHERE original_hex = ?',
		[fingerprint.toLowerCase()]
	);
	return result.affectedRows > 0;
}

export async function findSimilarFingerprint(fingerprint, threshold = SIMILARITY_THRESHOLD) {
	const [h1, h2, h3, h4] = splitHex(fingerprint.toLowerCase());
	const [rows] = await sharedDiscordPool.execute(`
		SELECT id, original_hex AS fingerprint, original_url, added_by, reason, created_at, (
			BIT_COUNT(h1 ^ CONV(?, 16, 10)) +
			BIT_COUNT(h2 ^ CONV(?, 16, 10)) +
			BIT_COUNT(h3 ^ CONV(?, 16, 10)) +
			BIT_COUNT(h4 ^ CONV(?, 16, 10))
		) AS distance
		FROM image_fingerprints
		HAVING distance <= ?
		ORDER BY distance ASC
		LIMIT 1
	`, [h1, h2, h3, h4, threshold]);

	return rows[0] || null;
}

export async function checkMessageForBlockedImage(message) {
	const attachments = [...message.attachments.values()].filter(attachment => {
		const contentType = (attachment.contentType || '').toLowerCase();
		return contentType.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif)$/i.test(attachment.name || '');
	});
	const urls = [...attachments.map(attachment => attachment.url), ...(message.content.match(IMAGE_URL_REGEX) || [])];

	for (const url of urls) {
		try {
			const fingerprint = await generateFingerprint(url);
			const match = await findSimilarFingerprint(fingerprint);
			if (match) return match;
		} catch (error) {
			if (error.statusCode !== 403 && error.statusCode !== 404) {
				console.error(`Failed to fingerprint image ${url}:`, error.message);
			}
		}
	}

	return null;
}
