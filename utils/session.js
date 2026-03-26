const fs = require('fs').promises;
const path = require('path');

const SESSION_FILE = path.join(__dirname, '../cookies.json');

const saveSession = async (page) => {
    try {
        const cookies = await page.cookies();
        await fs.writeFile(SESSION_FILE, JSON.stringify(cookies, null, 2));
        console.log('Session cookies saved securely.');
    } catch (err) {
        console.error('Failed to save session cookies:', err);
    }
};

const loadSession = async (page) => {
    try {
        const sessionData = await fs.readFile(SESSION_FILE);
        const cookies = JSON.parse(sessionData);
        if (cookies.length > 0) {
            await page.setCookie(...cookies);
            console.log('Previous session loaded into browser.');
            return true;
        }
    } catch (err) {
        console.log('No existing session found. A fresh login is required.');
    }
    return false;
};

module.exports = { saveSession, loadSession };
