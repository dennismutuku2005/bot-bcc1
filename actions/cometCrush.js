const { delay } = require('../utils/humanActions');

const navigateToCrashGames = async (page) => {
    console.log('Waiting for Crash Games menu item...');
    
    // Using Puppeteer's XPath selector to find the element containing text "Crash Games"
    const crashGamesSelector = '::-p-xpath(//span[contains(text(), "Crash Games")]/..)'; 
    
    await page.waitForSelector(crashGamesSelector, { visible: true, timeout: 15000 });
    
    console.log('Clicking on Crash Games...');
    await delay(1000, 2000); // Simulate human delay
    await page.click(crashGamesSelector);
    
    console.log('Navigated to Crash Games.');
    // Wait a bit for the next section to load
    await delay(2000, 4000);
};

const openCometCrush = async (page) => {
    console.log('Looking for Comet Crush...');
    await delay(1000, 2000);
    
    // We try to locate Comet Crush by text or alt attribute.
    const cometCrushSelector = '::-p-xpath(//*[contains(text(), "Comet Crush") or contains(@alt, "Comet Crush")])';
    
    try {
        await page.waitForSelector(cometCrushSelector, { visible: true, timeout: 15000 });
        console.log('Clicking on Comet Crush...');
        
        // Wait a small random delay
        await delay(500, 1500);
        await page.click(cometCrushSelector);
        
    } catch (e) {
        console.log('Could not find Comet Crush automatically. It might be inside an iframe or canvas.');
    }

    await delay(2000, 3000);
    console.log('Comet Crush module finished loading/clicking.');
};

module.exports = { navigateToCrashGames, openCometCrush };
