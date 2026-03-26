const { delay } = require('../utils/humanActions');

const navigateToCrashGames = async (page) => {
    console.log('Waiting for Crash Games menu item...');
    
    // Using Puppeteer's XPath selector to find the element containing text "Crash Games"
    const crashGamesSelector = '::-p-xpath((//span[contains(text(), "Crash Games")])[1]/..)'; 
    
    await page.waitForSelector(crashGamesSelector, { visible: true, timeout: 15000 });
    
    console.log('Clicking on Crash Games...');
    await delay(1000, 2000); // Simulate human delay
    
    // Use page.evaluate to bypass "not clickable" or overlay errors
    const elements = await page.$$(crashGamesSelector);
    if (elements.length > 0) {
        await elements[0].evaluate(el => el.click());
    } else {
        await page.click(crashGamesSelector);
    }
    
    console.log('Navigated to Crash Games.');
    // Wait a bit for the next section to load
    await delay(2000, 4000);
};

const openCometCrush = async (page) => {
    console.log('Navigating directly to Comet Crush (Real Mode)...');
    
    // Simulating human hesitation before clicking the "bookmark" or direct URL
    await delay(1500, 3000);
    
    // Bypass the "Changes you made may not be saved" alert
    // 1. Disable the beforeunload listener natively inside the browser page
    await page.evaluate(() => { window.onbeforeunload = null; });
    
    // 2. Set up a Puppeteer dialog handler just in case it triggers anyway
    const dialogHandler = async (dialog) => {
        console.log('Automatically accepting dialog:', dialog.message());
        await dialog.accept();
    };
    page.once('dialog', dialogHandler);
    
    // Direct link to the real money version of the game
    const gameUrl = 'https://www.betika.com/en-ke/crash-game/stp_crash_crashx_comet?mode=R';
    
    try {
        await page.goto(gameUrl, { waitUntil: 'networkidle2' });
        console.log('Successfully loaded Comet Crush game canvas.');
    } catch (e) {
        console.error('Failed to load the Comet Crush direct URL:', e);
    }

    // Clean up the listener so it doesn't leak memory or trigger unexpectedly later
    page.off('dialog', dialogHandler);

    // Wait for the iframe or canvas game engine to initialize
    await delay(4000, 6000);
    console.log('Comet Crush module finished loading.');
};

module.exports = { navigateToCrashGames, openCometCrush };
