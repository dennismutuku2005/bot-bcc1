const fs = require('fs').promises;
const path = require('path');

const GAME_URL_FILE = path.join(__dirname, '../game_url.json');

const saveGameUrl = async (url) => {
    try {
        const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour from now
        const data = {
            url,
            expiryTime
        };
        await fs.writeFile(GAME_URL_FILE, JSON.stringify(data, null, 2));
        console.log(`[SESSION] Real game URL saved. Expires at: ${new Date(expiryTime).toLocaleTimeString()}`);
    } catch (err) {
        console.error('Failed to save real game URL:', err);
    }
};

const getValidGameUrl = async () => {
    try {
        const data = await fs.readFile(GAME_URL_FILE, 'utf8');
        const session = JSON.parse(data);
        
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;
        
        // If not expired and has more than 10 minutes left
        if (session.expiryTime > now && (session.expiryTime - now) > tenMinutes) {
            console.log(`[SESSION] Found valid game URL. ${( (session.expiryTime - now) / 60000 ).toFixed(1)} minutes remaining.`);
            return session.url;
        } else {
            console.log('[SESSION] Game URL expired or expiring soon. Starting fresh login...');
        }
    } catch (err) {
        // No file or invalid JSON, ignore
    }
    return null;
};

module.exports = { saveGameUrl, getValidGameUrl };
