const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

const WALLET_LOG_FILE = path.join(__dirname, '../wallet_history.json');

// Initialize state
let currentBalance = config.wallet;
let totalGamesPlayed = 0;
let gamesThisSession = 0;
let consecutiveLosses = 0;
let history = [];
let pendingBets = []; 

const updateConfigFile = async (newBalance, currentStake) => {
    try {
        const configPath = path.join(__dirname, '../config.js');
        let content = await fs.readFile(configPath, 'utf8');
        
        // Update Wallet Balance
        content = content.replace(/wallet:\s*[\d.]+/, `wallet: ${Math.round(newBalance)}`);

        // Update active stake
        content = content.replace(/currentStake:\s*[\d.]+/, `currentStake: ${currentStake}`);

        await fs.writeFile(configPath, content);
    } catch (err) {
        console.error('[WALLET] Could not sync balance/stake to config.js:', err.message);
    }
};

const loadWalletHistory = async () => {
    try {
        const data = await fs.readFile(WALLET_LOG_FILE, 'utf8');
        const saved = JSON.parse(data);
        currentBalance = config.wallet; 
        totalGamesPlayed = saved.totalGamesPlayed || 0;
        history = saved.history || [];
        console.log(`[WALLET] Balance: ${currentBalance} KES. Total Games: ${totalGamesPlayed}`);
    } catch (e) {
        console.log(`[WALLET] Initialized with ${currentBalance} KES from config.`);
    }
};

const recordBet = async (gameId, bets) => {
    let roundStakes = 0;
    bets.forEach(b => { roundStakes += b.stake; });
    
    if (currentBalance < roundStakes) {
        console.log('\n🛑 INSUFFICIENT FUNDS! STOPPING.');
        process.exit(0);
    }

    currentBalance -= roundStakes;
    totalGamesPlayed += 1;
    gamesThisSession += 1;
    
    pendingBets.push({ gameId, bets });
    
    console.log(`[WALLET] Game started. Stake: ${roundStakes} KES. Balance: ${currentBalance.toFixed(2)} KES.`);
};

const resolveRound = async (gameId, multiplier) => {
    const betIndex = pendingBets.findIndex(b => b.gameId === gameId);
    if (betIndex === -1) return;
    
    const { bets } = pendingBets.splice(betIndex, 1)[0];
    let totalWinnings = 0;
    let roundStakes = 0;
    
    bets.forEach(b => {
        roundStakes += b.stake;
        if (multiplier >= b.autoCashout) {
            totalWinnings += b.stake * b.autoCashout;
        }
    });

    currentBalance += totalWinnings;
    const roundPnl = totalWinnings - roundStakes;
    
    // Martingale logic (1.9x model)
    if (roundPnl < 0) {
        consecutiveLosses += 1;
        console.log(`[WALLET] LOSS (${roundPnl.toFixed(0)} KES). Doubling stake!`);
        config.currentStake *= 2;
    } else {
        consecutiveLosses = 0;
        console.log(`[WALLET] WIN (+${roundPnl.toFixed(0)} KES)! Resetting stake.`);
        config.currentStake = config.baseBet;
    }

    // Record in history
    history.push({
        timestamp: new Date().toISOString(),
        gameId, gameNumber: totalGamesPlayed,
        multiplier, stakes: roundStakes,
        winnings: totalWinnings, pnl: roundPnl,
        balance: currentBalance
    });
    
    await saveHistory();

    // Limits checks
    if (config.rules.profitTarget && currentBalance >= config.rules.profitTarget) {
        console.log('💎 PROFIT TARGET REACHED!'); process.exit(0);
    }
    if (config.rules.stopAfterLosses && consecutiveLosses >= config.rules.stopAfterLosses) {
        console.log('⚠️ STOP LOSS TRIGGERED!'); process.exit(0);
    }
};

const saveHistory = async () => {
    try {
        const data = { currentBalance, totalGamesPlayed, history };
        await fs.writeFile(WALLET_LOG_FILE, JSON.stringify(data, null, 2));
        await updateConfigFile(currentBalance, config.currentStake);
    } catch (err) { }
};

module.exports = { loadWalletHistory, recordBet, resolveRound };
