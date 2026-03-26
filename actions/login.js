const { delay, typeLikeHuman } = require('../utils/humanActions');

const login = async (page, phoneNumber, password) => {
    console.log('Navigating to Betika...');
    await page.goto('https://www.betika.com/en-ke/login?next=%2F', { waitUntil: 'networkidle2' });
    
    const phoneInputSelector = 'input[name="phone-number"]';
    const passwordInputSelector = 'input[name="password"]';
    const loginButtonSelector = '.session__form__button.login';

    console.log('Checking if login form is present...');
    
    try {
        await page.waitForSelector(phoneInputSelector, { timeout: 5000 });
    } catch (e) {
        console.log('Login form not found. Assuming we are already logged in via active session cookies.');
        return false; // Did not perform a new login
    }

    console.log('Login form found. Typing credentials...');
    await delay(1000, 2000); // Wait a bit before starting to type

    console.log('Typing phone number...');
    // Click on the input first to simulate focus
    await page.click(phoneInputSelector);
    await delay(300, 700);
    await typeLikeHuman(page, phoneInputSelector, phoneNumber);
    
    console.log('Typing password...');
    await delay(500, 1500);
    // Click on the password input to simulate focus
    await page.click(passwordInputSelector);
    await delay(300, 700);
    await typeLikeHuman(page, passwordInputSelector, password);
    
    console.log('Clicking login button...');
    await delay(1000, 2000);
    await page.click(loginButtonSelector);
    
    console.log('Login action initiated.');
    // Let it resolve so main.js can handle the delay before fetching cookies
    return true; // Performed a new login
};

module.exports = { login };
