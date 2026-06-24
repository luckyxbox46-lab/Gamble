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

// --------------------------
// DATA FILE NOW OUTSIDE CODE FOLDER — GIT WILL NEVER DELETE IT
// --------------------------
const DATA_DIR = path.join(__dirname, '../../..'); // One level above your repo folder
const DATA_FILE = path.join(DATA_DIR, 'bot-persistent-data.json');
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

// Load data: SAVED VALUES ALWAYS WIN, NO RESETS
if (fs.existsSync(DATA_FILE)) {
  try {
    const savedRaw = fs.readFileSync(DATA_FILE, 'utf8');
    const saved = JSON.parse(savedRaw);
    // Merge: saved first, defaults only fill missing fields
    botData = {
      ...saved,
      stats: { ...defaultData.stats, ...saved.stats },
      disabledChannels: Array.isArray(saved.disabledChannels) ? saved.disabledChannels : [],
      silenceMode: { ...defaultData.silenceMode, ...saved.silenceMode },
      rewardsEnabled: { ...saved.rewardsEnabled }, // NEVER OVERWRITE
      ignoredUsers: Array.isArray(saved.ignoredUsers) ? saved.ignoredUsers : [],
      balances: { ...saved.balances }, // NEVER OVERWRITE
      rewardCfg: { ...defaultData.rewardCfg, ...saved.rewardCfg }
    };
    console.log('✅ Data loaded — rewards & balances preserved');
  } catch (err) {
    console.log('⚠️ Corrupted data — starting fresh');
    botData = { ...defaultData };
  }
} else {
  console.log('ℹ️ No data found — creating new permanent file');
  botData = { ...defaultData };
}

REWARD_THRESH = botData.rewardCfg.t || 10000;
REWARD_AMT = botData.rewardCfg.a || 2;

// Save function
const saveData = () => {
  botData.rewardCfg = { t: REWARD_THRESH, a: REWARD_AMT };
  fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2), 'utf8');
  console.log('💾 Data saved to permanent location');
};

// --------------------------
// PERMISSIONS
// --------------------------
const isOwner = m => m?.author?.username === OWNER;
const isAdmin = m => isOwner(m) || !!m?.member?.permissions?.has(PermissionsBitField.Flags.Administrator);
const isIgnored = id => botData.ignoredUsers.includes(id);

client.once('ready', () => console.log(`✅ Bot online: ${client.user.tag}`));

// --------------------------
// MESSAGE HANDLER
// --------------------------
client.on('messageCreate', async (m) => {
  if (!m || m.author.bot || !m.guild) return;
  const g = m.guild.id;
  const uId = m.author.id;

  // Rewards run first
  if (botData.rewardsEnabled[g] === true) {
    const now = Date.now();
    if (now - (msgCd.get(uId) || 0) > 2000 && m.content.trim() !== (lastMsg.get(uId) || '').trim()) {
      if (!botData.balances[uId]) botData.balances[uId] = { count: 0, earned: 0 };
      botData.balances[uId].count++;
      lastMsg.set(uId, m.content);
      msgCd.set(uId, now);
      const earned = Math.floor(botData.balances[uId].count / REWARD_THRESH) * REWARD_AMT;
      if (earned > botData.balances[uId].earned) {
        botData.balances[uId].earned = earned;
        saveData();
      }
    }
  }

  if (!m.content.startsWith(PREFIX)) return;
  if (isOwner(m)) { /* bypass */ }
  else if (isIgnored(uId)) return;
  else {
    if (botData.silenceMode[g]) return;
    if (botData.disabledChannels.includes(m.channel.id)) return;
  }

  const parts = m.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1);

  if (!['d','cf','choose'].includes(cmd) && !isOwner(m)) {
    const lastUsed = userCd.get(uId) || 0;
    if (Date.now() - lastUsed < CD) return m.reply(`⏳ Wait ${Math.ceil((CD - (Date.now() - lastUsed))/1000)}s`).catch(()=>{});
    userCd.set(uId, Date.now());
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
    case 'choose': {
      if (!args.length) return m.reply('❌ Usage: -choose <opt1> <opt2> ...');
      return m.reply(`🎯 Pick: ${args[Math.floor(Math.random() * args.length)]}`);
    }
    case 'ship': {
      if (!m.mentions.users.size) return m.reply('❌ Usage: -ship @user1 @user2');
      return m.reply(`💞 Compatibility: ${Math.floor(Math.random() * 100)}%`);
    }
    case 'stats': {
      const uptime = Math.floor((Date.now() - botData.stats.started) / 60000);
      return m.reply(`📊 Stats\n🎲 Rolls: ${botData.stats.rolls}\n🪙 Flips: ${botData.stats.flips}\n⏱️ Uptime: ${uptime}m`);
    }
    case 'rewardtoggle': {
      if (!isOwner(m)) return m.reply('❌ Only owner');
      botData.rewardsEnabled[g] = !botData.rewardsEnabled[g];
      saveData();
      return m.reply(botData.rewardsEnabled[g] ? '✅ Rewards ENABLED — PERMANENTLY SAVED' : '❌ Rewards DISABLED — PERMANENTLY SAVED');
    }
    case 'setreward': {
      if (!isOwner(m)) return m.reply('❌ Only owner');
      const t = parseInt(args[0]), a = parseFloat(args[1]);
      if (!t || !a || t < 1) return m.reply('❌ Usage: -setreward <msgs> <amount>');
      REWARD_THRESH = t; REWARD_AMT = a; saveData();
      return m.reply(`✅ Updated: ${formatNum(t)} msgs = $${a.toFixed(2)}`);
    }
    case 'balance': {
      const target = m.mentions.users.first() || m.author;
      if (m.mentions.users.first() && !isAdmin(m)) return m.reply('❌ Only admins');
      const data = botData.balances[target.id] || { count: 0, earned: 0 };
      const next = (Math.floor(data.count / REWARD_THRESH) + 1) * REWARD_THRESH;
      return m.reply(`💰 **${target.username}**\nMessages: ${formatNum(data.count)}\nEarned: $${data.earned.toFixed(2)}\nNext: ${formatNum(next)} msgs`);
    }
    case 'earningslb': {
      if (!botData.rewardsEnabled[g]) return m.reply('❌ Rewards disabled — use -rewardtoggle');
      const sorted = Object.entries(botData.balances).sort(([,a], [,b]) => b.earned - a.earned).slice(0,10);
      if (!sorted.length) return m.reply('📊 No earnings yet');
      let list = '🏆 **Top Earners**\n';
      for (let i=0; i<sorted.length; i++) {
        const u = await client.users.fetch(sorted[i][0]).catch(() => null);
        list += `${i+1}. ${u?.username||'Unknown'} | ${formatNum(sorted[i][1].count)} msgs | $${sorted[i][1].earned.toFixed(2)}\n`;
      }
      return m.reply(list);
    }
    // Manual save/backup commands
    case 'savedata': {
      if (!isOwner(m)) return m.reply('❌ Owner only');
      saveData();
      return m.reply('✅ All data saved — safe from git/deploys!');
    }
    case 'exportdata': {
      if (!isOwner(m)) return m.reply('❌ Owner only');
      try {
        await m.reply({ content: '📤 Your backup:', files: [{ attachment: DATA_FILE, name: `bot-backup-${Date.now()}.json` }] });
      } catch { return m.reply('❌ Could not send file'); }
      return;
    }
    // Admin commands
    case 'ignore': {
      if (!isAdmin(m)) return m.reply('❌ Only admins');
      const t = m.mentions.users.first();
      if (!t) return m.reply('❌ Usage: -ignore @user');
      if (isOwner({author:t})) return m.reply('❌ Cannot ignore owner');
      if (!botData.ignoredUsers.includes(t.id)) { botData.ignoredUsers.push(t.id); saveData(); return m.reply(`✅ Ignoring ${t.username}`); }
      return m.reply(`ℹ️ Already ignoring ${t.username}`);
    }
    case 'unignore': {
      if (!isAdmin(m)) return m.reply('❌ Only admins');
      const t = m.mentions.users.first();
      if (!t) return m.reply('❌ Usage: -unignore @user');
      if (botData.ignoredUsers.includes(t.id)) { botData.ignoredUsers = botData.ignoredUsers.filter(id=>id!==t.id); saveData(); return m.reply(`✅ Unignored ${t.username}`); }
      return m.reply(`ℹ️ Not ignored`);
    }
    case 'silence': {
      if (!isOwner(m)) return m.reply('❌ Only owner');
      botData.silenceMode[g] = !botData.silenceMode[g]; saveData();
      return m.reply(botData.silenceMode[g] ? '🔇 Commands off — rewards work' : '🔊 Commands on');
    }
    case 'disable': {
      if (!isAdmin(m)) return m.reply('❌ Only admins');
      if (!botData.disabledChannels.includes(m.channel.id)) { botData.disabledChannels.push(m.channel.id); saveData(); }
      return m.reply('🚫 Commands off here — rewards work');
    }
    case 'enable': {
      if (!isAdmin(m)) return m.reply('❌ Only admins');
      botData.disabledChannels = botData.disabledChannels.filter(ch=>ch!==m.channel.id); saveData();
      return m.reply('✅ Commands enabled');
    }
    case 'bully': {
      if (!isAdmin(m) || !m.mentions.users.first()) return m.reply('❌ Usage: -bully @user');
      const t = m.mentions.users.first();
      for (let i=0; i<8; i++) { await m.channel.send(`${t} 👊`).catch(()=>{}); await delay(600); }
      return;
    }
    // Dice War exactly like your screenshot
    case 'dw': {
      const argsParts = args.filter(a => !a.startsWith('<@'));
      const opp = m.mentions.users.first();
      const rounds = Math.max(1, Math.min(10, parseInt(argsParts[0]) || 5));
      const sides = Math.max(2, parseInt(argsParts[1]) || 1000);

      if (!opp) return m.reply('❌ Usage: -dw @user [rounds] [sides]\nExample: -dw @LocoPoco 5 1000');

      let yourScore = 0;
      let oppScore = 0;

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

        await m.channel.send(`Round ${i}: 🎲 ${yourRoll} vs 🎲 ${oppRoll} — ${result}`).catch(() => {});
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
