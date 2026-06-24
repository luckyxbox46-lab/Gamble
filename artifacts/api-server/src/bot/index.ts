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

// Format numbers: 1234 → 1.2k, 1234567 → 1.2m
const formatNum = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'm';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toString();
};

// --------------------------
// PERSISTENT DATA — NO RESET
// --------------------------
const DATA_FILE = path.join(__dirname, '..', '..', 'persistentData.json');
const defaultData = {
  stats: { rolls: 0, flips: 0, started: Date.now() },
  disabledChannels: [],
  silenceMode: {},
  rewardsEnabled: {},
  balances: {},
  rewardCfg: { t: 10000, a: 2 }
};

let botData;
if (fs.existsSync(DATA_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    botData = {
      ...defaultData,
      ...saved,
      rewardsEnabled: { ...defaultData.rewardsEnabled, ...saved.rewardsEnabled },
      balances: { ...defaultData.balances, ...saved.balances }
    };
    console.log('✅ Data loaded & preserved');
  } catch (e) {
    console.log('⚠️ Starting fresh');
    botData = { ...defaultData };
  }
} else {
  console.log('ℹ️ New data file created');
  botData = { ...defaultData };
}

REWARD_THRESH = botData.rewardCfg.t || 10000;
REWARD_AMT = botData.rewardCfg.a || 2;

const save = () => {
  botData.rewardCfg = { t: REWARD_THRESH, a: REWARD_AMT };
  fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2), 'utf8');
};

// --------------------------
// PERMISSIONS
// --------------------------
const isOwner = m => m?.author?.username === OWNER;
const isAdmin = m => isOwner(m) || !!m?.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

client.once('clientReady', () => console.log(`✅ Bot online: ${client.user.tag}`));

// --------------------------
// MESSAGE HANDLER
// --------------------------
client.on('messageCreate', async (m) => {
  if (!m || m.author.bot || !m.guild) return;
  const g = m.guild.id;
  const c = m.channel.id;

  // REWARDS RUN FIRST — ALWAYS
  if (botData.rewardsEnabled[g] === true) {
    const u = m.author.id;
    const now = Date.now();
    if (now - (msgCd.get(u) || 0) > 2000 && m.content.trim() !== (lastMsg.get(u) || '').trim()) {
      if (!botData.balances[u]) botData.balances[u] = { count: 0, earned: 0 };
      botData.balances[u].count++;
      lastMsg.set(u, m.content);
      msgCd.set(u, now);
      const earned = Math.floor(botData.balances[u].count / REWARD_THRESH) * REWARD_AMT;
      if (earned > botData.balances[u].earned) {
        botData.balances[u].earned = earned;
        save();
      }
    }
  }

  // ONLY PROCESS COMMANDS IF STARTS WITH PREFIX
  if (!m.content.startsWith(PREFIX)) return;

  // OWNER BYPASS ALL RESTRICTIONS
  if (!isOwner(m)) {
    if (botData.silenceMode[g]) return;
    if (botData.disabledChannels.includes(c)) return;
  }

  const parts = m.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1);

  // COOLDOWN
  if (!['d','cf','choose'].includes(cmd) && !isOwner(m)) {
    const lastUsed = userCd.get(m.author.id) || 0;
    if (Date.now() - lastUsed < CD) {
      return m.reply(`⏳ Wait ${Math.ceil((CD - (Date.now() - lastUsed)) / 1000)}s`).catch(() => {});
    }
    userCd.set(m.author.id, Date.now());
  }

  // --------------------------
  // COMMANDS
  // --------------------------
  switch (cmd) {
    case 'd': {
      const max = parseInt(args[0]) || 100;
      const roll = Math.floor(Math.random() * max) + 1;
      botData.stats.rolls++; save();
      return m.reply(`🎲 Roll: ${roll}`);
    }
    case 'cf': {
      const res = Math.random() < 0.5 ? 'Heads' : 'Tails';
      botData.stats.flips++; save();
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
      save();
      return m.reply(botData.rewardsEnabled[g] ? '✅ Rewards ENABLED' : '❌ Rewards DISABLED');
    }
    case 'setreward': {
      if (!isOwner(m)) return m.reply('❌ Only owner');
      const t = parseInt(args[0]), a = parseFloat(args[1]);
      if (!t || !a || t < 1 || a < 0) return m.reply('❌ Usage: -setreward <msgs> <amount>');
      REWARD_THRESH = t; REWARD_AMT = a; save();
      return m.reply(`✅ Updated: ${t} messages = $${a.toFixed(2)}`);
    }
    case 'balance': {
      const target = m.mentions.users.first() || m.author;
      if (m.mentions.users.first() && !isAdmin(m)) return m.reply('❌ Only admins can check others');
      const data = botData.balances[target.id] || { count: 0, earned: 0 };
      const next = (Math.floor(data.count / REWARD_THRESH) + 1) * REWARD_THRESH;
      return m.reply(
`💰 **${target.username}**
Messages Sent: ${formatNum(data.count)}
Earned: $${data.earned.toFixed(2)}
Next reward at: ${formatNum(next)} messages`
      );
    }
    case 'earningslb': {
      if (botData.rewardsEnabled[g] !== true) return m.reply('❌ Rewards are disabled — use -rewardtoggle to enable');
      const sorted = Object.entries(botData.balances)
        .sort(([,a], [,b]) => b.earned - a.earned)
        .slice(0, 10);
      if (!sorted.length) return m.reply('📊 No earnings recorded yet');

      let list = '🏆 **Top Earners**\n';
      for (let i = 0; i < sorted.length; i++) {
        const [userId, data] = sorted[i];
        const user = await client.users.fetch(userId).catch(() => null);
        const username = user?.username || 'Unknown';
        list += `${i+1}. ${username} | ${formatNum(data.count)} msgs | $${data.earned.toFixed(2)}\n`;
      }
      return m.reply(list);
    }
    case 'silence': {
      if (!isOwner(m)) return m.reply('❌ Only owner');
      botData.silenceMode[g] = !botData.silenceMode[g]; save();
      return m.reply(botData.silenceMode[g] ? '🔇 Commands off — rewards still work' : '🔊 Commands on');
    }
    case 'disable': {
      if (!isAdmin(m)) return m.reply('❌ Only admins');
      if (!botData.disabledChannels.includes(c)) { botData.disabledChannels.push(c); save(); }
      return m.reply('🚫 Commands off here — rewards still work');
    }
    case 'enable': {
      if (!isAdmin(m)) return m.reply('❌ Only admins');
      botData.disabledChannels = botData.disabledChannels.filter(ch => ch !== c); save();
      return m.reply('✅ Commands enabled here');
    }
    case 'bully': {
      if (!isAdmin(m) || !m.mentions.users.first()) return m.reply('❌ Usage: -bully @user');
      const t = m.mentions.users.first();
      for (let i=0; i<8; i++) { await m.channel.send(`${t} 👊`).catch(()=>{}); await delay(600); }
      return;
    }
    case 'dw': {
      const opp = m.mentions.users.first() || { username: 'Opponent' };
      const r = Math.max(1, Math.min(10, parseInt(args[1]) || 5));
      const s = Math.max(2, Math.min(20, parseInt(args[2]) || 6));
      let p1=0, p2=0;
      await m.reply(`🎲 Dice War: ${m.author.username} vs ${opp.username}`);
      for (let i=1; i<=r; i++) {
        const r1 = Math.floor(Math.random()*s)+1, r2 = Math.floor(Math.random()*s)+1;
        if (r1>r2) p1++; else if (r2>r1) p2++;
        await m.channel.send(`Round ${i}: ${r1}-${r2} | ${p1}-${p2}`).catch(()=>{});
        await delay(900);
      }
      const res = p1>p2 ? `✅ ${m.author.username} wins!` : p2>p1 ? `✅ ${opp.username} wins!` : '⚖️ Draw!';
      return m.channel.send(`🏆 Final: ${p1}-${p2}\n${res}`);
    }
    case 'cw': {
      const opp = m.mentions.users.first(), side = args[1]?.toLowerCase();
      if (!opp || !['heads','tails'].includes(side)) return m.reply('❌ Usage: -cw @user <heads/tails>');
      let u=0, o=0;
      await m.reply(`🪙 Coin War: ${m.author.username} vs ${opp.username}`);
      while (u<2 && o<2) {
        const f = Math.random()<0.5 ? 'Heads' : 'Tails';
        f.toLowerCase() === side ? u++ : o++;
        await m.channel.send(`Flip: ${f} | ${u}-${o}`).catch(()=>{});
        await delay(900);
      }
      return m.channel.send(u===2 ? `🏆 ${m.author.username} wins!` : `🏆 ${opp.username} wins!`);
    }
    case 'help': {
      return m.reply(`📖 **COMMANDS & USAGE**

💰 **REWARDS**
\`-rewardtoggle\` — Enable/disable rewards
\`-setreward <msgs> <amount>\` — Set reward rate
\`-balance [@user]\` — View messages & earned
\`-earningslb\` — View top earners

🎲 **GENERAL**
\`-d [max]\` — Roll dice
\`-cf\` — Flip coin
\`-choose <opt1> <opt2> ...\` — Pick option
\`-ship @user1 @user2\` — Compatibility
\`-stats\` — Bot stats
\`-dw [rounds] [sides]\` — Dice battle
\`-cw @user <heads/tails>\` — Coin battle

👑 **ADMIN**
\`-disable\` — Disable commands here
\`-enable\` — Enable commands here
\`-bully @user\` — Send pings

🔒 **OWNER ONLY**
\`-silence\` — Mute/unmute all commands
`);
    }
  }
});

client.login(token).catch(err => console.error('❌ Login failed:', err.message));
