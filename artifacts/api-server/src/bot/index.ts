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

// --------------------------
// SETTINGS
// --------------------------
const PREFIX = '-';
const OWNER = '.luckyyy_'; // ONLY YOU
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

// 🚀 PERMANENT PATH — NO MORE RESETS
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

// Load saved data FIRST
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
    console.log('✅ Loaded saved data — rewards safe');
  } catch {
    console.log('⚠️ Starting fresh data');
    botData = { ...defaultData };
  }
} else {
  botData = { ...defaultData };
}

REWARD_THRESH = botData.rewardCfg.t || 10000;
REWARD_AMT = botData.rewardCfg.a || 2;

const saveData = () => {
  botData.rewardCfg = { t: REWARD_THRESH, a: REWARD_AMT };
  fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2), 'utf8');
  console.log('💾 Data saved');
};

// --------------------------
// PERMISSIONS
// --------------------------
const isOwner = m => m.author.username === OWNER;
const isAdmin = m => isOwner(m) || m.member?.permissions?.has(PermissionsBitField.Flags.Administrator);
const isIgnored = id => botData.ignoredUsers.includes(id);

// ✅ Fixed deprecation warning
client.once('clientReady', () => console.log(`✅ Bot online: ${client.user.tag}`));

// --------------------------
// MESSAGE HANDLER
// --------------------------
client.on('messageCreate', async m => {
  if (!m.guild || m.author.bot) return;
  const g = m.guild.id;
  const u = m.author.id;

  // Reward system
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

  // --------------------------
  // COMMANDS
  // --------------------------
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
      if (!isOwner(m)) return m.reply('❌ Only owner can use this command');
      botData.rewardsEnabled[g] = !botData.rewardsEnabled[g];
      saveData();
      return m.reply(botData.rewardsEnabled[g] ? '✅ Rewards ENABLED & saved' : '❌ Rewards DISABLED & saved');
    }
    case 'setreward': {
      if (!isOwner(m)) return m.reply('❌ Only owner can use this command');
      const t = parseInt(args[0]), a = parseFloat(args[1]);
      if (!t || !a || t < 1) return m.reply('❌ Usage: -setreward <messages> <amount>');
      REWARD_THRESH = t; REWARD_AMT = a; saveData();
      return m.reply(`✅ Updated: ${formatNum(t)} msgs = $${a.toFixed(2)}`);
    }
    case 'balance': {
      const target = m.mentions.users.first() || m.author;
      if (m.mentions.users.first() && !isAdmin(m)) return m.reply('❌ Only admins can check others\' balance');
      const data = botData.balances[target.id] || { count: 0, earned: 0 };
      const next = (Math.floor(data.count / REWARD_THRESH) + 1) * REWARD_THRESH;
      return m.reply(`💰 **${target.username}**\nMessages: ${formatNum(data.count)}\nEarned: $${data.earned.toFixed(2)}\nNext reward at: ${formatNum(next)}`);
    }
    case 'earningslb': {
      if (!botData.rewardsEnabled[g]) return m.reply('❌ Rewards are disabled');
      const sorted = Object.entries(botData.balances).sort(([,a], [,b]) => b.earned - a.earned).slice(0,10);
      if (!sorted.length) return m.reply('📊 No earnings data yet');
      let list = '🏆 **Top Earners**\n';
      for (let i = 0; i < sorted.length; i++) {
        const user = await client.users.fetch(sorted[i][0]).catch(() => null);
        list += `${i+1}. ${user?.username || 'Unknown'} | ${formatNum(sorted[i][1].count)} msgs | $${sorted[i][1].earned.toFixed(2)}\n`;
      }
      return m.reply(list);
    }
    // 🔒 OWNER ONLY COMMANDS
    case 'savedata': {
      if (!isOwner(m)) return m.reply('❌ This command is for the owner only');
      saveData();
      return m.reply('✅ All data saved successfully — safe from resets!');
    }
    case 'exportdata': {
      if (!isOwner(m)) return m.reply('❌ This command is for the owner only');
      try {
        await m.reply({
          content: '📤 Here is your full backup file:',
          files: [{ attachment: DATA_FILE, name: `bot-backup-${Date.now()}.json` }]
        });
      } catch {
        return m.reply('❌ Failed to send backup file');
      }
      return;
    }
    case 'silence': {
      if (!isOwner(m)) return m.reply('❌ Only owner can use this');
      botData.silenceMode[g] = !botData.silenceMode[g];
      saveData();
      return m.reply(botData.silenceMode[g] ? '🔇 Commands disabled here — rewards still work' : '🔊 Commands enabled');
    }
    // 👑 ADMIN COMMANDS
    case 'ignore': {
      if (!isAdmin(m)) return m.reply('❌ Only admins can use this');
      const target = m.mentions.users.first();
      if (!target) return m.reply('❌ Usage: -ignore @user');
      if (isOwner({author: target})) return m.reply('❌ Cannot ignore the owner');
      if (!botData.ignoredUsers.includes(target.id)) {
        botData.ignoredUsers.push(target.id);
        saveData();
        return m.reply(`✅ Now ignoring ${target.username}`);
      }
      return m.reply(`ℹ️ Already ignoring ${target.username}`);
    }
    case 'unignore': {
      if (!isAdmin(m)) return m.reply('❌ Only admins can use this');
      const target = m.mentions.users.first();
      if (!target) return m.reply('❌ Usage: -unignore @user');
      if (botData.ignoredUsers.includes(target.id)) {
        botData.ignoredUsers = botData.ignoredUsers.filter(id => id !== target.id);
        saveData();
        return m.reply(`✅ No longer ignoring ${target.username}`);
      }
      return m.reply(`ℹ️ ${target.username} is not ignored`);
    }
    case 'disable': {
      if (!isAdmin(m)) return m.reply('❌ Only admins can use this');
      if (!botData.disabledChannels.includes(m.channel.id)) {
        botData.disabledChannels.push(m.channel.id);
        saveData();
      }
      return m.reply('🚫 Commands disabled in this channel');
    }
    case 'enable': {
      if (!isAdmin(m)) return m.reply('❌ Only admins can use this');
      botData.disabledChannels = botData.disabledChannels.filter(ch => ch !== m.channel.id);
      saveData();
      return m.reply('✅ Commands enabled in this channel');
    }
    case 'bully': {
      if (!isAdmin(m) || !m.mentions.users.first()) return m.reply('❌ Usage: -bully @user');
      const target = m.mentions.users.first();
      for (let i = 0; i < 8; i++) {
        await m.channel.send(`${target} 👊`).catch(()=>{});
        await delay(600);
      }
      return;
    }
    // ✅ GAMES
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
        let result;
        if (yourRoll > oppRoll) {
          yourScore++;
          result = `You take the round!`;
        } else if (oppRoll > yourRoll) {
          oppScore++;
          result = `${opp} takes the round!`;
        } else {
          result = `Draw — no points!`;
        }
        await m.channel.send(`Round ${i}: 🎲 ${yourRoll} vs 🎲 ${oppRoll} — ${result}`).catch(()=>{});
        await delay(900);
      }

      const final = `🏆 Final Score: You ${yourScore} - ${oppScore} ${opp}\n` +
        (yourScore > oppScore ? `✅ You win ${yourScore}-${oppScore}!` :
         oppScore > yourScore ? `❌ ${opp} wins ${oppScore}-${yourScore}!` :
         `⚖️ Match ends in a draw!`);
      return m.channel.send(final);
    }
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
      return m.channel.send(u === 2 ? `🏆 ${m.author} wins!` : `🏆 ${opp} wins!`);
    }
    case 'ship': {
      if (!m.mentions.users.size) return m.reply('❌ Usage: -ship @user1 @user2');
      return m.reply(`💞 Compatibility: ${Math.floor(Math.random() * 100)}%`);
    }
    case 'choose': {
      if (!args.length) return m.reply('❌ Usage: -choose <option1> <option2> ...');
      return m.reply(`🎯 Pick: ${args[Math.floor(Math.random() * args.length)]}`);
    }
    case 'stats': {
      const uptime = Math.floor((Date.now() - botData.stats.started) / 60000);
      return m.reply(`📊 Bot Stats\n🎲 Total Rolls: ${botData.stats.rolls}\n🪙 Total Flips: ${botData.stats.flips}\n⏱️ Uptime: ${uptime} minutes`);
    }
    // ✅ Normal Help: Public + Admin commands ONLY
    case 'help': {
      return m.reply(`📖 **COMMANDS**

💰 **REWARDS**
\`-balance [@user]\` — Check your balance
\`-earningslb\` — View top earners

🎲 **GAMES**
\`-d [max]\` — Roll dice
\`-cf\` — Flip coin
\`-choose <opt1> <opt2>...\` — Pick random option
\`-ship @user1 @user2\` — Get compatibility %
\`-dw @user [rounds] [sides]\` — Dice War
\`-cw @user <heads/tails>\` — Coin War
\`-stats\` — View bot stats

👑 **ADMIN**
\`-ignore @user\` — Block commands from a user
\`-unignore @user\` — Allow commands again
\`-disable\` — Disable commands in this channel
\`-enable\` — Enable commands in this channel
\`-bully @user\` — Send spam messages to a user
`);
    }
    // ✅ LuckysHelp: ONLY YOU, shows everything
    case 'luckyshelp': {
      if (!isOwner(m)) return m.reply('❌ This command is for the owner only');
      return m.reply(`📖 **LUCKY'S FULL COMMAND LIST**

💰 **REWARDS & DATA**
\`-rewardtoggle\` — Enable/disable rewards
\`-setreward <msgs> <amount>\` — Set reward amount per messages
\`-balance [@user]\` — Check balance
\`-earningslb\` — View top earners
\`-savedata\` — Manually save all data
\`-exportdata\` — Download full backup file

🎲 **GAMES**
\`-d [max]\` — Roll dice
\`-cf\` — Flip coin
\`-choose <opt1> <opt2>...\` — Pick random option
\`-ship @user1 @user2\` — Get compatibility %
\`-dw @user [rounds] [sides]\` — Dice War
\`-cw @user <heads/tails>\` — Coin War
\`-stats\` — View bot stats

👑 **ADMIN**
\`-ignore @user\` — Block commands from a user
\`-unignore @user\` — Allow commands again
\`-disable\` — Disable commands in this channel
\`-enable\` — Enable commands in this channel
\`-bully @user\` — Send spam messages to a user

🔒 **OWNER ONLY**
\`-silence\` — Mute/unmute all commands globally
`);
    }
  }
});

client.login(token).catch(err => console.error('❌ Login failed:', err.message));
