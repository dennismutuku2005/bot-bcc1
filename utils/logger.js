const fs = require('fs');
const path = require('path');

/**
 * Logs a single burst event to bursts.json
 */
const logBurst = (burstObj) => {
    const filePath = path.join(__dirname, '../bursts.json');
    let bursts = [];

    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            bursts = JSON.parse(data);
        }
    } catch (e) {}

    // Use requested format: { gameId, crashAt, time }
    bursts.push(burstObj);

    try {
        fs.writeFileSync(filePath, JSON.stringify(bursts, null, 2), 'utf8');
        console.log(`[LOGGER] Burst recorded: ${burstObj.crashAt}x (Game: ${burstObj.gameId.substring(0, 8)}...)`);
    } catch (e) {
        console.error('Error writing to bursts.json:', e.message);
    }
};

/**
 * Logs raw WebSocket data for debugging to packets.log
 */
const logPacket = (data) => {
    const filePath = path.join(__dirname, '../packets.log');
    const entry = `[${new Date().toISOString()}] ${data}\n`;
    fs.appendFileSync(filePath, entry, 'utf8');
};

/**
 * Appends a raw or decoded object to logger.json for historical analysis.
 */
const logToLoggerJson = (message) => {
    const filePath = path.join(__dirname, '../logger.json');
    let logs = [];

    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            logs = JSON.parse(data);
        }
    } catch (e) {
        // Start fresh if file is empty/invalid
    }

    logs.push({
        timestamp: new Date().toISOString(),
        data: message
    });

    try {
        fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), 'utf8');
    } catch (e) {
        console.error('Error writing to logger.json:', e.message);
    }
};

/**
 * Logs the full raw crash event to crash_events.json
 */
const logRawCrash = (eventData) => {
    const filePath = path.join(__dirname, '../crash_events.json');
    let events = [];

    try {
        if (fs.existsSync(filePath)) {
            events = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {}

    events.push({
        timestamp: new Date().toISOString(),
        raw: eventData
    });

    try {
        fs.writeFileSync(filePath, JSON.stringify(events, null, 2), 'utf8');
    } catch (e) {}
};

module.exports = { logBurst, logPacket, logToLoggerJson, logRawCrash };
