import formatDuration from '../utils/formatDuration.js';
import { STAFF_CHANNEL_ID } from '../config.js';
import { getFilesPortalParticipation, getUserParticipationSummary, logUserActivity, recordMemberLeave } from '../utils/database.js';

function formatDate(date) {
	return date ? new Date(date).toISOString().slice(0, 10) : 'never';
}

function formatPortalParticipation(portal, commandInteractions) {
	if (portal === null) return `Files Portal: database unavailable; **${commandInteractions}** Discord archive command interactions`;
	if (!portal.hasAccount) return `Files Portal: no account; **${commandInteractions}** Discord archive command interactions`;

	return `Files Portal: account since **${formatDate(portal.createdAt)}**, last login **${formatDate(portal.lastLogin)}**, ` +
		`**${portal.logins}** logins, **${portal.uploads.total}** uploads (${portal.uploads.approved} approved), ` +
		`**${portal.edits.total}** metadata edits, **${portal.favorites}** current favorites; ` +
		`**${commandInteractions}** Discord archive command interactions`;
}

export async function execute(client, member) {
	const { user, guild } = member;
	const staffChannel = guild.channels.cache.get(STAFF_CHANNEL_ID);
	const tenure = await recordMemberLeave(member);
	const [participation, portal] = await Promise.all([
		getUserParticipationSummary(user.id),
		getFilesPortalParticipation(user.id)
	]);

	await staffChannel?.send(
		`👋 **Member left** 👋\n` +
		`User: **${user.tag}** (${user.id})\n` +
		`Latest stay: **${formatDuration(tenure.latestDurationMs)}**\n` +
		`Total stay: **${formatDuration(tenure.totalDurationMs)}** across **${tenure.stayCount}** stay${tenure.stayCount === 1 ? '' : 's'}\n` +
		`Participation: **${participation.messages}** messages, **${participation.reactions}** reactions, **${participation.commands}** commands\n` +
		formatPortalParticipation(portal, participation.portal.total)
	);

	await logUserActivity(user.id, user.username, 'leave', {
		duration: tenure.latestDurationMs,
		totalDuration: tenure.totalDurationMs,
		stayCount: tenure.stayCount,
		sessionTracked: true
	});
}
