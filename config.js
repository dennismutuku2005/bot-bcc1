module.exports = {
    wallet: 999601,
    // Martingale Strategy Settings (from analyze.js)
    baseBet: 1,
    cashout: 1.9,
    // Current active stake (Updated by the bot)
    currentStake: 1,
    rules: {
        stopAfterLosses: 10,
        profitTarget: 1000000,
        maxRoundsPerSession: 50,
        minBankroll: 100,
        stopLoss: 5000
    }
};