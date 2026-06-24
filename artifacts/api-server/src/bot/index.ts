const {Client,GatewayIntentBits,PermissionsBitField} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load token
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('❌ FATAL: DISCORD_BOT_TOKEN missing! Set in Railway Variables.');
  process.exit(1);
}
console.log(`✅ Token loaded (length: ${token.length})`);

// Bot setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// --------------------------
// YOUR SETTINGS
// --------------------------
const PREFIX = '-';
const OWNER = '.luckyyy_'; // FULL BYPASS
const CD = 20000;
let REWARD_THRESH = 10000;
let REWARD_AMT = 2;
const userCd = new Map(), lastMsg = new Map(), msgCd = new Map();
const delay = ms => new Promise(r => setTimeout(r, ms));

// 🔹 PERSISTENT DATA LOCATION — SURVIVES DEPLOYS
// Use /tmp or a dedicated Railway volume path
const DATA_FILE = path.join(__dirname, '..', '..', 'persistentData.json');

// 🔹 DEFAULT STRUCTURE — only used if NO saved data exists
const defaultData = {
  stats: { rolls: 0, flips: 0, started: Date.now() },
  disabledChannels: [],
  silenceMode: {},
  rewardsEnabled: {},
  balances: {},
  rewardCfg: { t: 10000, a: 2 }
};

// 🔹 LOAD DATA — MERGE, NEVER OVERWRITE
let botData;
if (fs.existsSync(DATA_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    // Merge saved data into defaults — keeps old balances, adds new fields
    botData = { ...defaultData, ...saved };
    console.log('✅ Loaded existing data — balances preserved');
  } catch (e) {
    console.log('⚠️ Corrupted data file — starting fresh');
    botData = { ...defaultData };
  }
} else {
  console.log('ℹ️ No existing data found — creating new file');
  botData = { ...defaultData };
}

// Apply saved reward settings
REWARD_THRESH = botData.rewardCfg.t || 10000;
REWARD_AMT = botData.rewardCfg.a || 2;

// 🔹 SAVE FUNCTION — only writes changes, never resets
const save = () => {
  botData.rewardCfg = { t: REWARD_THRESH, a: REWARD_AMT };
  fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2), 'utf8');
};

// --------------------------
// PERMISSIONS
// --------------------------
const isOwner = (m) => m?.author?.username === OWNER;
const isAdmin = (m) => isOwner(m) || !!m?.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

// --------------------------
// READY
// --------------------------
client.once('clientReady', () => console.log(`✅ Bot online: ${client.user.tag}`));

// --------------------------
// MESSAGE HANDLER — REWARDS FIRST, ALWAYS
// --------------------------
client.on('messageCreate', async (m) => {
  if (!m || m.author.bot || !m.guild) return;
  const g = m.guild.id;
  const c = m.channel.id;

  // ==============================================
  // 🔹 REWARD SYSTEM — NEVER BLOCKED, NEVER RESET
  // ==============================================
  if (botData.rewardsEnabled[g]) {
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

  // ==============================================
  // 🔹 COMMAND SYSTEM
  // ==============================================
  if (!m.content.startsWith(PREFIX)) return;

  // Owner bypass ALL restrictions
  if (!isOwner(m)) {
    if (botData.silenceMode[g]) return;
    if (botData.disabledChannels.includes(c)) return;
  }

  const parts = m.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1);

  // Cooldown — owner bypass
  if (!['d', 'cf', 'choose'].includes(cmd) && !isOwner(m)) {
    const lastUsed = userCd.get(m.author.id) || 0;
    if (Date.now() - lastUsed < CD) {
      return m.reply(`⏳ Wait ${Math.ceil((CD - (Date.now() - lastUsed)) / 1000)}s`).catch(() => {});
    }
    userCd.set(m.author.id, Date.now());
  }

  // --------------------------
  // ALL COMMANDS
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
      if (!args.length) return m.reply('❌ Usage: -choose opt1 opt2 ...');
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
      botData.rewardsEnabled[g] = !botData.rewardsEnabled[g]; save();
      return m.reply(botData.rewardsEnabled[g] ? '✅ Rewards ENABLED' : '❌ Rewards DISABLED');
    }
    case 'setreward': {
      if (!isOwner(m)) return m.reply('❌ Only owner');
      const t = parseInt(args[0]), a = parseFloat(args[1]);
      if (!t || !a || t < 1 || a < 0) return m.reply('❌ Usage: -setreward <msgs> <$>');
      REWARD_THRESH = t; REWARD_AMT = a; save();
      return m.reply(`✅ Updated: ${t} msgs = $${a.toFixed(2)}`);
    }
    case 'balance': {
      const target = m.mentions.users.first() || m.author;
      if (m.mentions.users.first() && !isAdmin(m)) return m.reply('❌ Admin only');
      const d = botData.balances[target.id] || { count: 0, earned: 0 };
      const next = (Math.floor(d.count / REWARD_THRESH) + 1) * REWARD_THRESH;
      return m.reply(`💰 ${target.username}\nMessages: ${d.count}\nEarned: $${d.earned.toFixed(2)}\nNext: ${next}`);
    }
    case 'earningslb': {
      if (!botData.rewardsEnabled[g]) return m.reply('❌ Rewards are OFF');
      const sorted = Object.entries(botData.balances).sort((x,y) => y[1].earned - x[1].earned).slice(0,10);
      if (!sorted.length) return m.reply('📊 No earnings yet');
      let list = '🏆 Top Earners\n';
      for (let i=0; i<sorted.length; i++) {
        const u = await client.users.fetch(sorted[i][0]).catch(() => null);
        list += `${i+1}. ${u?.username || 'Unknown'} — $${sorted[i][1].earned.toFixed(2)}\n`;
      }
      return m.reply(list);
    }
    case 'silence': {
      if (!isOwner(m)) return m.reply('❌ Only owner');
      botData.silenceMode[g] = !botData.silenceMode[g]; save();
      return m.reply(botData.silenceMode[g] ? '🔇 Commands OFF — REWARDS STILL WORK ✅' : '🔊 Commands ON');
    }
    case 'disable': {
      if (!isAdmin(m)) return m.reply('❌ Admin only');
      if (!botData.disabledChannels.includes(c)) {
        botData.disabledChannels.push(c); save();
      }
      return m.reply('🚫 Commands OFF here — REWARDS STILL WORK ✅');
    }
    case 'enable': {
      if (!isAdmin(m)) return m.reply('❌ Admin only');
      botData.disabledChannels = botData.disabledChannels.filter(ch => ch !== c); save();
      return m.reply('✅ Commands back ON');
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
      if (!opp || !['heads','tails'].includes(side)) return m.reply('❌ Usage: -cw @user heads/tails');
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
      return m.reply(`📖 **COMMANDS**

💰 **REWARDS**
\`-rewardtoggle\` (Owner)
\`-setreward <msgs> <$\` (Owner)
\`-balance\` / \`-balance @user\`
\`-earningslb\`
*Rewards work EVEN IF commands are disabled/silenced*
*Balances NEVER reset on updates/pushes*

🎲 **GENERAL**
\`-d [max]\` • \`-cf\` • \`-choose\`
\`-ship\` • \`-stats\` • \`-dw\` • \`-cw\`

👑 **ADMIN**
\`-disable\` • \`-enable\` • \`-bully\`

🔒 **OWNER (.luckyyy_) — BYPASSES EVERYTHING**
\`-silence\`
`);
    }
  }
});

client.login(token).catch(err => console.error('❌ Login failed:', err.message));
