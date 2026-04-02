const { delay } = require('../utils/humanActions');
const { saveGameUrl } = require('../utils/gameUrl');
const { recordBet, resolveRound } = require('../utils/wallet');

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
        console.log('Successfully loaded Comet Crush game wrapper.');
    } catch (e) {
        console.error('Failed to load the Comet Crush direct URL:', e);
    }

    // --- DIRECT OPTIMIZATION ---
    // Extract the Token URL from the iframe and navigate the main page to it.
    console.log('Searching for the internal game engine URL...');
    let directGameUrl = null;
    const maxIframeRetries = 10;
    
    for (let i = 1; i <= maxIframeRetries; i++) {
        const frames = page.frames();
        const gameFrame = frames.find(f => f.url().includes('splitthepot.games') && f.url().includes('token='));
        
        if (gameFrame) {
            directGameUrl = gameFrame.url();
            console.log(`[HIJACK] Game token found on attempt ${i}`);
            break;
        }
        console.log(`Waiting for game engine to spin up... (${i}/${maxIframeRetries})`);
        await delay(1500, 2000);
    }

    if (directGameUrl) {
        console.log('Leaving Betika wrapper. Navigating directly to Splitthepot engine...');
        try {
            await page.goto(directGameUrl, { waitUntil: 'networkidle2' });
            console.log('Direct navigation successful. We are now "Inside" the game.');
            // Save the direct URL for future sessions
            await saveGameUrl(directGameUrl);
        } catch (e) {
            console.error('Failed to navigate to direct game URL:', e.message);
        }
    } else {
        console.warn('Could not extract direct game URL. Staying in iframe mode.');
    }
    // ----------------------------

    // Clean up the listener so it doesn't leak memory or trigger unexpectedly later
    page.off('dialog', dialogHandler);

    // Wait for the engine on the new page to initialize
    await delay(3000, 5000);
    
    // Clear the blocking onboarding UI (now on the direct page)
    await removePopup(page);
};

const { logBurst, logPacket, logToLoggerJson, logRawCrash } = require('../utils/logger');

const msgpack = require('@msgpack/msgpack');

/**
 * Intercepts WebSocket messages across ALL targets (main page + iframes).
 * This ensures we capture the game socket even when it runs inside a nested iframe.
 */
const setupWebSocketInterception = async (page) => {
    console.log('[SOCKET] Initializing Global Multi-Target Interceptor...');
    const browser = page.browser();
    const RECORD_SEPARATOR = 0x1e;

    // Track sessions to avoid duplicate listeners
    const activeSessions = new Set();

    /**
     * Decodes a SignalR VarInt length prefix.
     */
    const readVarInt = (buffer, offset) => {
        let value = 0;
        let shift = 0;
        let i = offset;
        while (i < buffer.length) {
            const byte = buffer[i++];
            value |= (byte & 0x7f) << shift;
            if ((byte & 0x80) === 0) break;
            shift += 7;
        }
        return { value, consumed: i - offset };
    };

    const config = require('../config');
    let lastMultiplier = null;
    let lastGameId = null;
    let lastTickTime = Date.now();
    let lastRecordedVal = null;
    let canBetThisRound = false; // Start as false to wait for the next full round
    const recordedGids = new Set(); 

    const placeBets = async (page, gid) => {
        const betToPlace = { stake: config.currentStake, autoCashout: config.cashout };
        await recordBet(gid, [betToPlace]);

        try {
            const frames = page.frames();
            for (const frame of frames) {
                const bettingSections = await frame.$$('.settings-wrapper');
                if (bettingSections.length >= 1) {
                    const section = bettingSections[0]; // ONLY First Card
                    
                    await section.evaluate((el, s) => {
                        const mainSwitch = el.querySelector('stp-switch input[role="switch"]');
                        if (mainSwitch && mainSwitch.ariaChecked === 'false') {
                            const label = mainSwitch.closest('.stp-switch-label');
                            if (label) label.click();
                        }

                        const fieldToggle = el.querySelector('stp-toggle button');
                        if (fieldToggle) {
                            const handles = Array.from(fieldToggle.querySelectorAll('.handle'));
                            const offHandleActive = handles.find(h => h.innerText.includes('OFF') && h.classList.contains('active'));
                            if (offHandleActive) fieldToggle.click();
                        }

                        const stakeInput = el.querySelector('.stake-input input') || el.querySelector('#stake-input');
                        const oddInput = el.querySelector('.input-container input') || el.querySelector('input[id^="mat-input-"]');

                        const set = (input, val) => {
                            if (!input) return;
                            input.focus(); input.value = val;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                            input.dispatchEvent(new Event('blur', { bubbles: true }));
                        };

                        set(stakeInput, s.stake);
                        set(oddInput, s.autoCashout);
                    }, betToPlace);

                    await new Promise(r => setTimeout(r, 150));

                    const status = await section.evaluate(async (el) => {
                        const findBtn = () => Array.from(el.querySelectorAll('button')).find(b => {
                            const t = b.innerText.toLowerCase();
                            return t.includes('play') || t.includes('next') || t.includes('place');
                        });
                        for (let r = 0; r < 20; r++) {
                            const btn = findBtn();
                            if (btn && !btn.disabled && !btn.innerText.includes('Cancel')) {
                                btn.click(); return "CLICKED";
                            }
                            if (btn && btn.innerText.includes('Cancel')) return "ALREADY_PLACED";
                            await new Promise(res => setTimeout(res, 100));
                        }
                        return "TIMEOUT";
                    });

                    console.log(`[BETTING] ${status}: KES ${betToPlace.stake} @ ${betToPlace.autoCashout}x`);
                    return true;
                }
            }
        } catch (e) {
            console.error('[BETTING] Error:', e.message);
        }
        return false;
    };

    const processSignalRMessage = (msg, format, targetUrl) => {
        try {
            let decoded;
            if (format === 'JSON') {
                const text = msg.toString('utf8');
                if (!text.startsWith('{')) return;
                decoded = JSON.parse(text);
            } else {
                try {
                    decoded = msgpack.decode(msg);
                } catch (e) { return; }
            }
            
            lastTickTime = Date.now();
            const type = decoded[3] || (decoded.type === 1 ? decoded.target : null);
            const payload = decoded[4] || decoded.arguments;
            if (!type || !payload) return;

            // 1. TICKER & EMERGENCY FALLBACK
            if (type === 'c' && payload[0]) {
                const arg = payload[0];
                const gid = arg[1];
                const state = arg[3]; 
                const multiplier = arg[6];

                // Check if we jumped to a new game
                if (gid !== lastGameId) {
                    if (lastGameId && !recordedGids.has(lastGameId) && lastMultiplier !== null) {
                        triggerManualRecord(lastGameId, lastMultiplier, "Ticker Fallback");
                    }
                    recordedGids.delete(gid); 
                    
                    if (lastGameId === null) {
                        console.log(`[BYPASS] Joined mid-game (ID: ${gid}). Waiting for next full round...`);
                    } else {
                        canBetThisRound = true; // Standard reset for new round
                    }
                    
                    lastGameId = gid;
                }

                // Trigger betting immediately AFTER round starts (State 3: Flying)
                // This ensures we are betting for the NEXT round as requested.
                if (state === 3 && canBetThisRound) {
                    canBetThisRound = false; 
                    // 500ms delay to let UI switch to "Next Round" mode
                    setTimeout(() => placeBets(page, gid), 500); 
                }

                if (typeof multiplier === 'number') {
                    lastMultiplier = multiplier;
                    if (state === 3) {
                        process.stdout.write(`\r[FLYING] Game: ${gid} | ${multiplier}x              `);
                    } else if ((state === 4 || state === 5) && !recordedGids.has(gid)) {
                        triggerManualRecord(gid, multiplier, "Canonical State");
                        // Clear console line and show round result
                    }
                }
            }

            // 2. THE MASTER TRUTH (history/recentCrashes)
            if (['history', 'recentCrashes', 'latestBets'].includes(type)) {
                const data = payload[0];
                const items = Array.isArray(data) ? data : (data.history || []);
                for (const item of items) {
                    const val = (typeof item === 'object') ? (item.m || item.multiplier) : item;
                    const gid = (typeof item === 'object') ? (item.i || item.id) : null;
                    
                    // We generate a temp key if no UUID provided
                    const key = gid || `val_${val}_${new Date().getMinutes()}`;
                    
                    if (val && !recordedGids.has(key)) {
                        triggerManualRecord(key, val, "Server History");
                    }
                }
            }

            if (recordedGids.size > 500) recordedGids.clear();
        } catch (e) { }
    };

    const triggerManualRecord = (gid, val, source) => {
        if (!gid || !val || recordedGids.has(gid)) return;
        process.stdout.write('\n');
        logBurst({
            gameId: gid,
            crashAt: parseFloat(val).toFixed(2),
            time: new Date().toISOString()
        });
        console.log(`[RECORD] Burst Captured: ${val}x (${source})`);
        resolveRound(gid, parseFloat(val));
        recordedGids.add(gid);
    };



    const attachToTarget = async (target) => {
        const targetId = target._targetId;
        if (activeSessions.has(targetId)) return;
        
        const type = target.type();
        if (type !== 'page' && type !== 'iframe' && type !== 'other') return;

        try {
            const client = await target.createCDPSession();
            activeSessions.add(targetId);
            
            await client.send('Network.enable');
            await client.send('Page.enable');

            client.on('Network.webSocketFrameReceived', ({ response }) => {
                const buffer = Buffer.from(response.payloadData, 'base64');
                try {
                    if (buffer.includes(RECORD_SEPARATOR)) {
                        let start = 0;
                        for (let i = 0; i < buffer.length; i++) {
                            if (buffer[i] === RECORD_SEPARATOR) {
                                const msg = buffer.slice(start, i);
                                if (msg.length > 0) processSignalRMessage(msg, 'JSON', target.url());
                                start = i + 1;
                            }
                        }
                    } else {
                        let offset = 0;
                        while (offset < buffer.length) {
                            try {
                                const { value: len, consumed } = readVarInt(buffer, offset);
                                offset += consumed;
                                if (len > 0 && offset + len <= buffer.length) {
                                    processSignalRMessage(buffer.slice(offset, offset + len), 'MSGPACK', target.url());
                                    offset += len;
                                } else if (len === 0) {
                                    offset++;
                                } else { break; }
                            } catch (e) { break; }
                        }
                    }
                } catch (e) {}
            });
        } catch (err) {}
    };

    // Watchdog
    setInterval(async () => {
        try {
            const idleTime = (Date.now() - lastTickTime) / 1000;
            if (idleTime > 30) {
                console.log(`\n[WATCHDOG] Silent for ${idleTime.toFixed(0)}s. Sniffing all frames...`);
                activeSessions.clear(); 
                const currentTargets = browser.targets();
                for (const t of currentTargets) {
                    if (t.type() === 'page' || t.type() === 'iframe') await attachToTarget(t);
                }
                if (idleTime > 120) {
                    console.log(`[WATCHDOG] CRITICAL SILENCE. Refreshing...`);
                    await page.reload({ waitUntil: 'networkidle2' }).catch(() => {});
                    lastTickTime = Date.now();
                }
            }
        } catch (e) {}
    }, 15000);

    browser.on('targetdestroyed', (t) => activeSessions.delete(t._id || t._targetId));
    browser.on('targetcreated', attachToTarget);

    await attachToTarget(page.target());
    const initialTargets = browser.targets();
    for (const t of initialTargets) await attachToTarget(t);

    console.log('[SOCKET] Global interceptor active. Sniffing for precision bursts...');
};

const removePopup = async (page) => {
    console.log('Checking for onboarding popup in all frames...');
    
    // We'll retry a few times as the popup might load slightly after the initial page load
    const maxRetries = 5;
    for (let retry = 1; retry <= maxRetries; retry++) {
        try {
            const frames = page.frames();
            console.log(`Scanning ${frames.length} frames (Attempt ${retry}/${maxRetries})...`);

            for (const frame of frames) {
                // Check if this frame has the popup text
                const hasPopupText = await frame.evaluate(() => {
                    const text = document.body.innerText;
                    return text.includes('space suits') || text.includes('astronauts') || text.includes('cosmic gamble');
                });

                if (hasPopupText) {
                    console.log(`Onboarding popup text detected in frame: ${frame.url()}`);
                    
                    const clicked = await frame.evaluate(() => {
                        const selectors = [
                            'button[stptrack="onboarding-close-on-welcome"]',
                            '.onboarding-popup-container button',
                            'button.mdc-button--unelevated .mdc-button__label', // Matches the "Close" button structure
                            'button:has(.mdc-button__label)',
                            '.onboarding-popup-controls button'
                        ];

                        for (const selector of selectors) {
                            const btns = Array.from(document.querySelectorAll(selector));
                            const closeBtn = btns.find(b => b.innerText.toLowerCase().includes('close') || b.innerText.toLowerCase().includes('skip'));
                            
                            if (closeBtn && closeBtn.offsetParent !== null) {
                                closeBtn.click();
                                return `Clicked button matching ${selector} with text ${closeBtn.innerText}`;
                            }
                            
                            // Try clicking the first button in the selector list if no text match
                            const firstBtn = document.querySelector(selector);
                            if (firstBtn && firstBtn.offsetParent !== null) {
                                firstBtn.click();
                                return `Clicked first button matching ${selector}`;
                            }
                        }

                        // Broadest fallback: any button containing "Close"
                        const allButtons = Array.from(document.querySelectorAll('button'));
                        const fallbackBtn = allButtons.find(b => 
                            (b.innerText.toLowerCase().includes('close') || b.innerText.toLowerCase().includes('skip')) 
                            && b.offsetParent !== null
                        );

                        if (fallbackBtn) {
                            fallbackBtn.click();
                            return `Clicked fallback button containing 'Close'`;
                        }

                        return null;
                    });

                    if (clicked) {
                        console.log('Successfully closed popup:', clicked);
                        return; // Done
                    }
                }
            }
            
            // If not found, wait a bit before retrying
            await delay(2000, 3000);
        } catch (e) {
            console.log(`Error during frame scan (Attempt ${retry}):`, e.message);
        }
    }
    
    console.log('Could not find or close the onboarding popup after several attempts.');
};

module.exports = { navigateToCrashGames, openCometCrush, removePopup, setupWebSocketInterception };
