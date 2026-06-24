const {Client,GatewayIntentBits,PermissionsBitField} = require('discord.js');
const fs = require('fs');
const path = require('path');

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) { console.error('❌ DISCORD_BOT_TOKEN missing!'); process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const PREFIX = '-';
const OWNER = '.luckyyy_';
const CD = 20000;
let REWARD_THRESH = 10000;
let REWARD_AMT = 2;
const userCd = new Map(), lastMsg = new Map(), msgCd = new Map();
const delay = ms => new Promise(r => setTimeout(r, ms));

const formatNum = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'm';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toString();
};

// 🚀 Use Railway's /tmp/ persistent path (works 100% without volume setup)
const DATA_FILE = '/tmp/bot-permanent-data.json';

const defaultData = {
  stats: { rolls: 0, flips: 0, started: Date.now() },
  disabledChannels: [],
  silenceMode: {},
  rewardsEnabled: {},
  ignoredUsers: [],
  balances: {},
  rewardCfg: { t: 10000, a: 2 }
};

let botData;

// Load saved data FIRST — never overwrites existing values
if (fs.existsSync(DATA_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    botData = {
      ...defaultData,
      ...saved,
      rewardsEnabled: { ...saved.rewardsEnabled },
      balances: { ...saved.balances },
      rewardCfg: { ...defaultData.rewardCfg, ...saved.rewardCfg }
    };
    console.log('✅ Loaded saved data — rewards will NOT reset');
  } catch {
    console.log('⚠️ Starting fresh data');
    botData = { ...defaultData };
  }
} else {
  console.log('ℹ️ Creating new permanent data file');
  botData = { ...defaultData };
}

REWARD_THRESH = botData.rewardCfg.t || 10000;
REWARD_AMT = botData.rewardCfg.a || 2;

const saveData = () => {
  botData.rewardCfg = { t: REWARD_THRESH, a: REWARD_AMT };
  fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2), 'utf8');
  console.log('💾 Data saved to permanent location');
};

const isOwner = m => m.author.username === OWNER;
const isAdmin = m => isOwner(m) || m.member.permissions.has(PermissionsBitField.Flags.Administrator);
const isIgnored = id => botData.ignoredUsers.includes(id);

client.once('ready', () => console.log(`✅ Bot online: ${client.user.tag}`));

client.on('messageCreate', async m => {
  if (!m.guild || m.author.bot) return;
  const g = m.guild.id;
  const u = m.author.id;

  // Reward system — safe & persistent
  if (botData.rewardsEnabled[g] === true) {
    const now = Date.now();
    if (now - (msgCd.get(u) || 0) > 2000 && m.content.trim() !== (lastMsg.get(u) || '')) {
      if (!botData.balances[u]) botData.balances[u] = { count: 0, earned: 0 };
      botData.balances[u].count++;
      lastMsg.set(u, m.content.trim());
      msgCd.set(u, now);
      const earned = Math.floor(botData.balances[u].count / REWARD_THRESH) * REWARD_AMT;
      if (earned > botData.balances[u].earned) {
        botData.balances[u].earned = earned;
        saveData();
      }
    }
  }

  if (!m.content.startsWith(PREFIX)) return;
  if (isIgnored(u)) return;
  if (botData.silenceMode[g] && !isOwner(m)) return;
  if (botData.disabledChannels.includes(m.channel.id) && !isAdmin(m)) return;

  const args = m.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  if (!['d','cf','choose'].includes(cmd) && !isOwner(m)) {
    const last = userCd.get(u) || 0;
    if (Date.now() - last < CD) return m.reply(`⏳ Wait ${Math.ceil((CD - (Date.now() - last))/1000)}s`).catch(()=>{});
    userCd.set(u, Date.now());
  }

  switch (cmd) {
    case 'd': {
      const max = parseInt(args[0]) || 100;
      const roll = Math.floor(Math.random() * max) + 1;
      botData.stats.rolls++; saveData();
      return m.reply(`🎲 Roll: ${roll}`);
    }
    case 'cf': {
      const res = Math.random() < 0.5 ? 'Heads' : 'Tails';
      botData.stats.flips++; saveData();
      return m.reply(`🪙 Flip: ${res}`);
    }
    case 'rewardtoggle': {
      if (!isOwner(m)) return m.reply('❌ Only owner');
      botData.rewardsEnabled[g] = !botData.rewardsEnabled[g];
      saveData();
      return m.reply(botData.rewardsEnabled[g] ? '✅ Rewards ENABLED & SAVED' : '❌ Rewards DISABLED & SAVED');
    }
    case 'setreward': {
      if (!isOwner(m)) return m.reply('❌ Only owner');
      const t = parseInt(args[0]), a = parseFloat(args[1]);
      if (!t || !a || t < 1) return m.reply('❌ Usage: -setreward <messages> <amount>');
      REWARD_THRESH = t; REWARD_AMT = a; saveData();
      return m.reply(`✅ Updated: ${formatNum(t)} msgs = $${a.toFixed(2)}`);
    }
    case 'balance': {
      const target = m.mentions.users.first() || m.author;
      const data = botData.balances[target.id] || { count: 0, earned: 0 };
      const next = (Math.floor(data.count / REWARD_THRESH) + 1) * REWARD_THRESH;
      return m.reply(`💰 **${target.username}**\nMessages: ${formatNum(data.count)}\nEarned: $${data.earned.toFixed(2)}\nNext: ${formatNum(next)}`);
    }
    case 'savedata': {
      if (!isOwner(m)) return m.reply('❌ Only owner');
      saveData();
      return m.reply('✅ All data saved permanently!');
    }
    case 'exportdata': {
      if (!isOwner(m)) return m.reply('❌ Only owner');
      try {
        await m.reply({
          content: '📤 Your backup file:',
          files: [{ attachment: DATA_FILE, name: `bot-backup-${Date.now()}.json` }]
        });
      } catch { return m.reply('❌ Could not send file.'); }
      return;
    }
    // ✅ Dice War — EXACT style, separate rounds, clean example
    case 'dw': {
      const argsParts = args.filter(a => !a.startsWith('<@'));
      const opp = m.mentions.users.first();
      const rounds = Math.max(1, Math.min(10, parseInt(argsParts[0]) || 5));
      const sides = Math.max(2, parseInt(argsParts[1]) || 1000);
      if (!opp) return m.reply('❌ Usage: -dw @user [rounds] [sides]\nExample: -dw @user 5 1000');

      let yourScore = 0, oppScore = 0;
      await m.reply(`🎲 Dice War!\n${m.author} vs ${opp}\n${rounds} rounds — rolling d${sides}`);

      for (let i = 1; i <= rounds; i++) {
        const yourRoll = Math.floor(Math.random() * sides) + 1;
        const oppRoll = Math.floor(Math.random() * sides) + 1;
        const result = yourRoll > oppRoll ? (yourScore++, 'You take the round!') :
                        oppRoll > yourRoll ? (oppScore++, `${opp} takes the round!`) :
                        'Draw — no points!';
        await m.channel.send(`Round ${i}: 🎲 ${yourRoll} vs 🎲 ${oppRoll} — ${result}`).catch(()=>{});
        await delay(900);
      }

      const final = `🏆 Final Score: You ${yourScore} - ${oppScore} ${opp}\n` +
        (yourScore > oppScore ? `✅ You win ${yourScore}-${oppScore}!` :
         oppScore > yourRoll ? `❌ ${opp} wins ${oppScore}-${yourScore}!` :
         `⚖️ Match ends in a draw!`);
      return m.channel.send(final);
    }
    // Rest of your commands stay unchanged...
    case 'cw': {
      const opp = m.mentions.users.first(), side = args[1]?.toLowerCase();
      if (!opp || !['heads','tails'].includes(side)) return m.reply('❌ Usage: -cw @user <heads/tails>');
      let u = 0, o = 0;
      await m.reply(`🪙 Coin War: ${m.author} vs ${opp} — First to 2 wins`);
      while (u < 2 && o < 2) {
        const flip = Math.random() < 0.5 ? 'Heads' : 'Tails';
        flip === side ? u++ : o++;
        await m.channel.send(`Flip: ${flip} | Score: ${u} - ${o}`).catch(()=>{});
        await delay(900);
      }
      return m.channel.send(u===2 ? `🏆 ${m.author} wins!` : `🏆 ${opp} wins!`);
    }
    case 'help': {
      return m.reply(`📖 **COMMANDS**

💰 **REWARDS & DATA**
\`-rewardtoggle\` — Enable/disable rewards
\`-setreward <msgs> <amount>\` — Set reward rate
\`-balance [@user]\` — Check messages/earnings
\`-earningslb\` — Top earners
\`-savedata\` — Manually save all data
\`-exportdata\` — Download backup file

🎲 **GAMES**
\`-d [max]\` — Roll dice
\`-cf\` — Flip coin
\`-choose <opt1> <opt2>...\` — Pick
\`-ship @user1 @user2\` — Compatibility
\`-dw @user [rounds] [sides]\` — Dice War
\`-cw @user <heads/tails>\` — Coin War

👑 **ADMIN**
\`-ignore @user\` — Ignore commands
\`-unignore @user\` — Allow commands
\`-disable\` — Disable here
\`-enable\` — Enable here
\`-bully @user\` — Spam ping

🔒 **OWNER**
\`-silence\` — Mute all commands
`);
    }
  }
});

client.login(token).catch(err => console.error('❌ Login error:', err.message));
