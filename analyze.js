// ============================================================================
//  CRASH GAME DUAL-BET HYBRID ANALYZER — Pure Model Edition
//  ─────────────────────────────────────────────────────────────────────────
//
//  WHAT THIS SCRIPT DOES
//  ─────────────────────
//  This script reads a bursts.json file and simulates a Dual-Bet strategy:
//    - Bet 1: 70 KES @ 1.7x (The Anchor)
//    - Bet 2: 30 KES @ 3.0x (The Booster)
//
//  If the round results in a net LOSS (crash < 1.7x), BOTH stakes are doubled
//  for the next round to recover. If the round results in a PROFIT (crash ≥ 1.7x),
//  stakes are reset to the base (70 & 30).
//
//  HOW TO RUN
//  ──────────
//    node analyze.js bursts.json
//
// ============================================================================

const fs   = require('fs');
const path = require('path');

// ── ANSI COLOR CODES FOR TERMINAL OUTPUT ──────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';
const DIM    = '\x1b[2m';

const green  = s => `${GREEN}${s}${RESET}`;
const red    = s => `${RED}${s}${RESET}`;
const yellow = s => `${YELLOW}${s}${RESET}`;
const cyan   = s => `${CYAN}${s}${RESET}`;
const bold   = s => `${BOLD}${s}${RESET}`;
const dim    = s => `${DIM}${s}${RESET}`;

// ── CONFIGURATION (THE MODEL) ──────────────────────────────────────────────────

const STAKE1   = 70;   // Anchor bet
const CASHOUT1 = 1.7;  // Anchor target

const STAKE2   = 30;   // Booster bet
const CASHOUT2 = 3.0;  // Booster target

const WINDOW   = 30;   // Games per session
const MULTIPLIER = 2;  // Recovery multiplier after loss

// ── HELPER: pad strings for aligned columns ───────────────────────────────────
function rpad(str, width) {
  const visible = str.replace(/\x1b\[[0-9;]*m/g, '');
  const pad = Math.max(0, width - visible.length);
  return str + ' '.repeat(pad);
}
function lpad(str, width) {
  const visible = str.replace(/\x1b\[[0-9;]*m/g, '');
  const pad = Math.max(0, width - visible.length);
  return ' '.repeat(pad) + str;
}

// ============================================================================
//  PASS 1 — DRY RUN: find the lowest wallet dip
// ============================================================================
function dryRun(crashes) {
  const totalWindows = crashes.length - WINDOW + 1;
  let wallet = 0;
  let walletLow = 0;

  for (let start = 0; start < totalWindows; start++) {
    let curStake1 = STAKE1;
    let curStake2 = STAKE2;
    for (let i = 0; i < WINDOW; i++) {
      const crash  = crashes[start + i];
      
      const win1 = crash >= CASHOUT1;
      const win2 = crash >= CASHOUT2;
      
      const pnl1 = win1 ? +(curStake1 * (CASHOUT1 - 1)).toFixed(2) : -curStake1;
      const pnl2 = win2 ? +(curStake2 * (CASHOUT2 - 1)).toFixed(2) : -curStake2;
      const roundPnl = +(pnl1 + pnl2).toFixed(2);
      
      wallet = +(wallet + roundPnl).toFixed(2);
      if (wallet < walletLow) walletLow = wallet;
      
      if (roundPnl < 0) {
        curStake1 *= MULTIPLIER;
        curStake2 *= MULTIPLIER;
      } else {
        curStake1 = STAKE1;
        curStake2 = STAKE2;
      }
    }
  }

  return Math.ceil(-walletLow / 100) * 100;
}

// ============================================================================
//  PASS 2 — FULL RUN
// ============================================================================
function simulate(crashes, startingWallet) {

  const totalGames   = crashes.length;
  const totalWindows = totalGames - WINDOW + 1;

  console.log('\n' + bold('═'.repeat(70)));
  console.log(bold('  DUAL-BET HYBRID ANALYSIS — PURE MODEL'));
  console.log(bold('═'.repeat(70)));
  console.log(`  ${cyan('Bet 1 (Anchor)')} : ${STAKE1} KES @ ${CASHOUT1}x`);
  console.log(`  ${cyan('Bet 2 (Booster)')}: ${STAKE2} KES @ ${CASHOUT2}x`);
  console.log(`  ${cyan('Recovery')}      : Double stakes after net loss`);
  console.log(`  ${cyan('Session')}       : ${WINDOW} games per session`);
  console.log(`  ${cyan('Dataset')}       : ${totalGames} games → ${totalWindows} sessions`);
  console.log(`  ${cyan('Safe Deposit')}  : ${cyan(startingWallet.toLocaleString())} KES`);
  console.log(bold('═'.repeat(70)));

  let winCount      = 0;
  let lossCount     = 0;
  let totalProfit   = 0;
  let maxLoss       = 0;
  let maxProfit     = 0;
  let maxBetEver    = 0;
  let maxStreakEver = 0;

  let wallet     = startingWallet;
  let walletLow  = startingWallet;
  let walletHigh = startingWallet;

  const losingSessions = [];

  for (let start = 0; start < totalWindows; start++) {

    let curStake1 = STAKE1;
    let curStake2 = STAKE2;
    let sessionPL = 0;
    let streak    = 0;
    let maxStreak = 0;
    let maxRoundStake = STAKE1 + STAKE2;

    const sessionNum = start + 1;
    const gameStart  = start + 1;
    const gameEnd    = start + WINDOW;
    
    console.log('\n' + '─'.repeat(70));
    console.log(
      bold(`  SESSION ${String(sessionNum).padStart(3)}`) +
      dim(`  │  Games ${gameStart}–${gameEnd}`) +
      dim(`  │  In Wallet: `) +
      (wallet >= 0 ? green(wallet.toLocaleString()) : red(wallet.toLocaleString()))
    );
    console.log('─'.repeat(70));

    console.log(
      dim('  #   ') +
      dim(rpad('Crash', 10)) +
      dim(rpad('Total Bet', 12)) +
      dim(rpad('Result', 12)) +
      dim(rpad('Session P&L', 14)) +
      dim('Wallet')
    );
    console.log(dim('  ' + '·'.repeat(66)));

    for (let i = 0; i < WINDOW; i++) {
      const gameNum = start + i + 1;
      const crash   = crashes[start + i];
      
      const win1 = crash >= CASHOUT1;
      const win2 = crash >= CASHOUT2;
      
      const pnl1 = win1 ? +(curStake1 * (CASHOUT1 - 1)).toFixed(2) : -curStake1;
      const pnl2 = win2 ? +(curStake2 * (CASHOUT2 - 1)).toFixed(2) : -curStake2;
      const roundPnl = +(pnl1 + pnl2).toFixed(2);
      const totalStake = curStake1 + curStake2;

      sessionPL = +(sessionPL + roundPnl).toFixed(2);
      wallet = +(wallet + roundPnl).toFixed(2);

      if (wallet < walletLow)  walletLow  = wallet;
      if (wallet > walletHigh) walletHigh = wallet;
      if (totalStake > maxRoundStake) maxRoundStake = totalStake;
      if (totalStake > maxBetEver) maxBetEver = totalStake;

      const numCol = dim(String(gameNum).padStart(4) + ' ');
      const crashStr = crash.toFixed(2) + 'x';
      const crashCol = (crash >= CASHOUT1) ? rpad(green(crashStr), 10) : rpad(red(crashStr), 10);
      const betCol = rpad(dim(totalStake.toLocaleString()), 12);
      
      const pnlDisplay = roundPnl >= 0 ? green('+' + roundPnl.toFixed(0)) : red(roundPnl.toFixed(0));
      const resCol = rpad(pnlDisplay, 12);
      
      const splDisplay = sessionPL >= 0 ? green('+' + sessionPL.toFixed(0)) : red(sessionPL.toFixed(0));
      const splCol = rpad(splDisplay, 14);
      
      const walletDisplay = wallet >= 0 ? green(wallet.toLocaleString()) : red(wallet.toLocaleString());

      console.log('  ' + numCol + crashCol + betCol + resCol + splCol + walletDisplay);

      if (roundPnl < 0) {
        streak++;
        if (streak > maxStreak) maxStreak = streak;
        if (streak > maxStreakEver) maxStreakEver = streak;
        curStake1 *= MULTIPLIER;
        curStake2 *= MULTIPLIER;
      } else {
        streak = 0;
        curStake1 = STAKE1;
        curStake2 = STAKE2;
      }
    }

    sessionPL = Math.round(sessionPL * 100) / 100;
    totalProfit += sessionPL;

    const sessionResult = sessionPL >= 0 ? green(`PROFIT  +${sessionPL.toFixed(0)}`) : red(`LOSS    ${sessionPL.toFixed(0)}`);
    console.log(dim('  ' + '·'.repeat(66)));
    console.log(
      `  ${bold('Session result:')} ${sessionResult}` +
      dim(`   │  Max Round Stake: ${maxRoundStake.toLocaleString()}`) +
      dim(`   │  Worst Streak: ${maxStreak}`)
    );

    if (sessionPL >= 0) {
      winCount++;
      if (sessionPL > maxProfit) maxProfit = sessionPL;
    } else {
      lossCount++;
      if (-sessionPL > maxLoss) maxLoss = -sessionPL;
      losingSessions.push({ session: sessionNum, games: `${gameStart}–${gameEnd}`, profit: sessionPL, maxRoundStake });
    }
  }

  const winRate = (winCount / totalWindows * 100).toFixed(1);
  const avgProfit = (totalProfit / totalWindows).toFixed(2);

  console.log('\n\n' + bold('═'.repeat(70)));
  console.log(bold('  FINAL SUMMARY REPORT'));
  console.log(bold('═'.repeat(70)));
  console.log(`  Winning sessions  : ${green(winCount)} / ${totalWindows} (${winRate}% win rate)`);
  console.log(`  Total net profit  : ${totalProfit >= 0 ? green(totalProfit.toFixed(0)) : red(totalProfit.toFixed(0))} KES`);
  console.log(`  Avg per session   : ${avgProfit >= 0 ? green(avgProfit) : red(avgProfit)} KES`);
  console.log(`  Worst session     : ${red('-' + maxLoss)} KES`);
  console.log(`  Longest streak    : ${maxStreakEver} losses in a row`);
  console.log(`  Max bet reached   : ${yellow(maxBetEver.toLocaleString())} KES`);
  console.log(`\n  ${bold('WALLET PERFORMANCE')}`);
  console.log(`  Started with      : ${cyan(startingWallet.toLocaleString())}`);
  console.log(`  Highest point     : ${green(walletHigh.toLocaleString())}`);
  console.log(`  Lowest dip        : ${yellow(walletLow.toLocaleString())}`);
  console.log(`  Final Wallet      : ${wallet >= 0 ? green(wallet.toLocaleString()) : red(wallet.toLocaleString())}`);
  console.log(bold('═'.repeat(70)) + '\n');
}

// ============================================================================
//  ENTRY POINT
// ============================================================================

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node analyze.js <path-to-bursts.json>');
  process.exit(1);
}

const abs = path.resolve(filePath);
if (!fs.existsSync(abs)) {
  console.error(`File not found: ${abs}`);
  process.exit(1);
}

let raw;
try {
  raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
} catch (e) {
  console.error('Could not parse JSON:', e.message);
  process.exit(1);
}

const crashes = Array.isArray(raw)
  ? raw.map(item => (typeof item === 'number' ? item : parseFloat(item.crashAt)))
  : [];

if (crashes.length === 0 || crashes.some(isNaN)) {
  console.error('JSON must be an array of numbers or objects with a "crashAt" field.');
  process.exit(1);
}

const minWallet = dryRun(crashes);
simulate(crashes, minWallet);
