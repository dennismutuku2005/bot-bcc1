const { delay, typeLikeHuman } = require('../utils/humanActions');

const login = async (page, phoneNumber, password) => {
    console.log('Navigating to login page...');
    await page.goto('https://www.betika.com/en-ke/login?next=%2F', { waitUntil: 'networkidle2' });
    
    // The user provided the HTML snippet, the phone number input has name='phone-number' or we can use CSS classes.
    // .session__form__phone input or input[name="phone-number"]
    
    const phoneInputSelector = 'input[name="phone-number"]';
    const passwordInputSelector = 'input[name="password"]';
    // Using the specific class from the user's HTML payload
    const loginButtonSelector = '.session__form__button.login';

    console.log('Waiting for login form...');
    await page.waitForSelector(phoneInputSelector);
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
    // Let it resolve so main.js can handle what to do next
};

module.exports = { login };
