import { promises as fs } from 'fs';
import { join } from 'path';

export default async () => {
    const blacklistPath = join(process.cwd(), 'data', 'blacklist.json');
    try {
        const data = await fs.readFile(blacklistPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(blacklistPath, JSON.stringify({}), 'utf8');
            return {};
        }
        console.error('Error reading blacklist:', error);
        return {};
    }
};
