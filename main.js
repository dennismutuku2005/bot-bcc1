require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { login } = require('./actions/login');
const { navigateToCrashGames, openCometCrush } = require('./actions/cometCrush');
const { saveSession, loadSession } = require('./utils/session');
const { delay } = require('./utils/humanActions');

(async () => {
    const args = ['--start-maximized'];
    if (process.env.PROXY_URL && process.env.PROXY_URL.trim() !== '') {
        args.push(`--proxy-server=${process.env.PROXY_URL.trim()}`);
        console.log(`Using proxy: ${process.env.PROXY_URL}`);
    }

    // Launch browser
    const browser = await puppeteer.launch({ 
        headless: false, // Set to true to run in headless mode in production
        defaultViewport: null,
        args: args // Start browser maximized to behave like a normal user, and optionally with a proxy
    });
    
    try {
        const pages = await browser.pages();
        const page = pages.length > 0 ? pages[0] : (await browser.newPage());
        
        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
        
        // Credentials from .env
        const myPhoneNumber = process.env.PHONE_NUMBER;
        const myPassword = process.env.PASSWORD;
        
        if (!myPhoneNumber || !myPassword) {
            throw new Error('Please define PHONE_NUMBER and PASSWORD in your .env file');
        }
        
        // Attempt to load previous session before logging in
        await loadSession(page);
        
        // Run modular login action
        const didNewLogin = await login(page, myPhoneNumber, myPassword);
        
        console.log('Login flow successful. Proceeding to Comet Crush navigation...');
        
        // Wait for page to reload or settle after login
        await delay(3000, 5000); 
        
        // If it was a new login, save the newly generated cookies
        if (didNewLogin) {
            await saveSession(page);
        } 
        
        // Navigate to Crash Games
        await navigateToCrashGames(page);
        
        // Navigate to Comet Crush
        await openCometCrush(page);
        
        console.log('Testing completed successfully. Waiting 10 seconds before closing...');
    } catch (error) {
        console.error('An error occurred during testing:', error);
    } finally {
        // Leave the browser open for 10 seconds after completion or failure 
        // to let the user see the result of the login attempt.
        await delay(10000, 10000); // 10s wait
        console.log('Closing browser...');
        await browser.close();
    }
})();
