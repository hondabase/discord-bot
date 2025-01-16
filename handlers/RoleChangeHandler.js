import { HANGOUT_CHANNEL_ID, STAFF_CHANNEL_ID } from '../config.js';
import { logUserActivity } from '../utils/database.js';

const roleChangeQueue    = new Map();
const roleChangeTimeouts = new Map();

/**
 * Sends the role changes to the appropriate channel.
 */
function processRoleChanges(member) {
	const changes = roleChangeQueue.get(member.id);
	roleChangeQueue.delete(member.id);

	const addedRoles   = new Set();
	const removedRoles = new Set();

	changes.forEach(change => {
		change.added.forEach(role => addedRoles.add(role));
		change.removed.forEach(role => removedRoles.add(role));
	});

	const hangoutChannel = member.guild.channels.cache.get(HANGOUT_CHANNEL_ID);
	if (!hangoutChannel) {
		console.error(`Channel ${HANGOUT_CHANNEL_ID} not found in guild ${member.guild.name}`);
		return;
	}

	let message = `Role changes for ${member.user.username}:\n`;
	if (addedRoles.size > 0) message += `Added: ${Array.from(addedRoles).join(', ')}\n`;
	if (removedRoles.size > 0) message += `Removed: ${Array.from(removedRoles).join(', ')}`;

	logUserActivity(member.id, member.user.username, 'rolechange', { added: Array.from(addedRoles), removed: Array.from(removedRoles) });

	try {
		hangoutChannel.send(message);
	} catch (error) {
		console.error(`Failed to send role changes message for ${member.user.username}:`, error);
	}

	// Notify admin channel if important roles changed
	processImportantRoles(member, addedRoles, removedRoles);
}

/**
 * Handles changes to important roles like Staff/Admin.
 */
function processImportantRoles(member, addedRoles, removedRoles) {
	const importantRoles = ['Staff', 'Admin', 'Moderator'];

	const importantAdded   = Array.from(addedRoles).filter(role => importantRoles.includes(role));
	const importantRemoved = Array.from(removedRoles).filter(role => importantRoles.includes(role));

	if (importantAdded.length > 0 || importantRemoved.length > 0) {
		const adminChannel = member.guild.channels.cache.get(STAFF_CHANNEL_ID);
		if (adminChannel) {
			let message = `🚨 **Important Role Change** 🚨\nUser: ${member.user.username}\n`;
			if (importantAdded.length > 0) message   += `Added: ${importantAdded.join(', ')}\n`;
			if (importantRemoved.length > 0) message += `Removed: ${importantRemoved.join(', ')}`;
			adminChannel.send(message);
		}
	}
}

/**
 * Queues role changes for the user and debounces the updates.
 */
function queueRoleChange(member, changes) {
	if (!roleChangeQueue.has(member.id)) roleChangeQueue.set(member.id, []);

	roleChangeQueue.get(member.id).push(changes);

	if (roleChangeTimeouts.has(member.id)) clearTimeout(roleChangeTimeouts.get(member.id)); // Reset timer if new changes occur

	roleChangeTimeouts.set(member.id, setTimeout(() => {
		processRoleChanges(member);
		roleChangeTimeouts.delete(member.id); // Clean up timeout reference
	}, 5000)); // Wait 5 seconds for any more role changes before processing
}

/**
 * Processes and filters the role changes between old and new member states.
 */
export default (oldMember, newMember) => {
	const addedRoles   = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
	const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

	if (addedRoles.size > 0 || removedRoles.size > 0) {
		const changes = {
			added  : addedRoles.filter(role => role.name.toLowerCase() !== 'staff').map(role => role.name),
			removed: removedRoles.filter(role => role.name.toLowerCase() !== 'staff').map(role => role.name),
		};

		if (changes.added.length > 0 || changes.removed.length > 0) queueRoleChange(newMember, changes);
	}
};
