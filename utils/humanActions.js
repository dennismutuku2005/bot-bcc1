// Function to add a random delay between actions to simulate human behavior
const delay = (min, max) => new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));

// Function to simulate human-like typing
const typeLikeHuman = async (page, selector, text) => {
    const input = await page.$(selector);
    if (!input) throw new Error(`Element ${selector} not found`);
    
    // Clear existing value if any
    await input.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    
    for (let char of text) {
        await page.type(selector, char, { delay: Math.random() * 100 + 50 }); // 50ms to 150ms delay
    }
};

module.exports = {
    delay,
    typeLikeHuman
};
