require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { openCometCrush, setupWebSocketInterception, removePopup } = require('./actions/cometCrush');
const { delay } = require('./utils/humanActions');
const { getValidGameUrl } = require('./utils/gameUrl');
const { loadWalletHistory } = require('./utils/wallet');

(async () => {
    await loadWalletHistory();

    const browser = await puppeteer.launch({ 
        headless: false, 
        defaultViewport: null,
        args: ['--start-maximized'] 
    });
    
    try {
        const pages = await browser.pages();
        const page = pages.length > 0 ? pages[0] : (await browser.newPage());
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
        
        console.log('[START] Jumping directly to Comet Crush...');
        await setupWebSocketInterception(page);
        
        const directUrl = await getValidGameUrl() || 'https://www.betika.com/en-ke/crash-game/stp_crash_crashx_comet?mode=R';
        await page.goto(directUrl, { waitUntil: 'networkidle2' });
        
        await delay(3000, 5000);
        await removePopup(page);
        
        console.log('Bot is live and monitoring rounds.');
        await new Promise(() => {}); 
        
    } catch (error) {
        console.error('[CRITICAL ERROR]:', error);
    } finally {
        await browser.close();
    }
})();
