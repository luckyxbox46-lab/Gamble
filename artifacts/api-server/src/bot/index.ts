const {Client,GatewayIntentBits,PermissionsBitField} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load token
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('❌ FATAL: DISCORD_BOT_TOKEN is missing! Set it in Railway Variables.');
  process.exit(1);
}
console.log(`✅ Token loaded successfully (length: ${token.length})`);

// Bot setup with all required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Your original settings
const PREFIX = '-', OWNER = '.luckyyy_', CD = 20000;
let REWARD_THRESH = 10000, REWARD_AMT = 2;
const userCd = new Map(), lastMsg = new Map(), msgCd = new Map();
const delay = ms => new Promise(r => setTimeout(r, ms));

// Persistent data file
const DATA_FILE = path.join(__dirname, '..', '..', 'persistentData.json');
let botData = {
  stats: { rolls: 0, flips: 0, started: Date.now() },
  disabled: [],
  silence: {},
  rewards: {},
  balances: {},
  rewardCfg: { t: 10000, a: 2 }
};

// Load saved data
if (fs.existsSync(DATA_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    Object.assign(botData, saved);
    REWARD_THRESH = botData.rewardCfg.t || 10000;
    REWARD_AMT = botData.rewardCfg.a || 2;
  } catch (e) {
    console.log('ℹ️ Created new data file');
  }
}

// Save function
const save = () => {
  botData.rewardCfg = { t: REWARD_THRESH, a: REWARD_AMT };
  fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2), 'utf8');
};

// ✅ SAFE CHECKS — NO MORE UNDEFINED ERRORS
const isAdmin = (m) => {
  if (!m || !m.author) return false;
  if (m.author.username === OWNER) return true;
  return !!m.member?.permissions?.has(PermissionsBitField.Flags.Administrator);
};
const isOwner = (m) => m && m.author && m.author.username === OWNER;

// Fixed ready event
client.once('clientReady', () => console.log(`✅ Bot online: ${client.user.tag}`));

// Message handler
client.on('messageCreate', async (m) => {
  if (!m || m.author.bot || !m.guild) return;
  const g = m.guild.id, c = m.channel.id;

  if (botData.disabled.includes(c)) return;

  // Reward system
  if (!m.content.startsWith(PREFIX)) {
    if (!botData.rewards[g]) return;
    const u = m.author.id, now = Date.now();
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
    return;
  }

  if (botData.silence[g] && !isOwner(m)) return;

  const parts = m.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || '', args = parts.slice(1);

  // Cooldown
  if (!['d', 'cf', 'choose'].includes(cmd) && !isAdmin(m)) {
    const lastUsed = userCd.get(m.author.id) || 0;
    if (Date.now() - lastUsed < CD) {
      return m.reply(`⏳ Wait ${Math.ceil((CD - (Date.now() - lastUsed)) / 1000)}s`).catch(() => {});
    }
    userCd.set(m.author.id, Date.now());
  }

  // All original commands
  switch (cmd) {
    case 'd': {
      const max = parseInt(args[0]) || 100;
      const roll = Math.floor(Math.random() * max) + 1;
      botData.stats.rolls++;
      save();
      return m.reply(`🎲 Roll: ${roll}`);
    }
    case 'cf': {
      const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
      botData.stats.flips++;
      save();
      return m.reply(`🪙 Flip: ${result}`);
    }
    case 'choose': {
      if (!args.length) return m.reply('❌ Usage: -choose option1 option2 ...');
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
      if (!isOwner(m)) return m.reply('❌ Only owner can use this');
      botData.rewards[g] = !botData.rewards[g];
      save();
      return m.reply(botData.rewards[g] ? '✅ Rewards enabled' : '❌ Rewards disabled');
    }
    case 'setreward': {
      if (!isOwner(m)) return m.reply('❌ Only owner can use this');
      const t = parseInt(args[0]), a = parseFloat(args[1]);
      if (!t || !a || t < 1 || a < 0) return m.reply('❌ Usage: -setreward <message_count> <amount>');
      REWARD_THRESH = t;
      REWARD_AMT = a;
      save();
      return m.reply(`✅ Updated: ${t} messages = $${a.toFixed(2)}`);
    }
    case 'balance': {
      const target = m.mentions.users.first() || m.author;
      if (m.mentions.users.first() && !isAdmin(m)) return m.reply('❌ Only admins can check others\' balance');
      const data = botData.balances[target.id] || { count: 0, earned: 0 };
      const nextReward = (Math.floor(data.count / REWARD_THRESH) + 1) * REWARD_THRESH;
      return m.reply(`💰 ${target.username}\nMessages sent: ${data.count}\nEarned: $${data.earned.toFixed(2)}\nNext reward at: ${nextReward} messages`);
    }
    case 'earningslb': {
      if (!botData.rewards[g]) return m.reply('❌ Rewards are disabled here');
      const sorted = Object.entries(botData.balances).sort((x, y) => y[1].earned - x[1].earned).slice(0, 10);
      if (!sorted.length) return m.reply('📊 No earnings recorded yet');
      let list = '🏆 Top Earners\n';
      for (let i = 0; i < sorted.length; i++) {
        const user = await client.users.fetch(sorted[i][0]).catch(() => null);
        list += `${i + 1}. ${user?.username || 'Unknown User'} — $${sorted[i][1].earned.toFixed(2)}\n`;
      }
      return m.reply(list);
    }
    case 'silence': {
      if (!isOwner(m)) return m.reply('❌ Only owner can use this');
      botData.silence[g] = !botData.silence[g];
      save();
      return m.reply(botData.silence[g] ? '🔇 Bot silenced' : '🔊 Bot active');
    }
    case 'disable': {
      if (!isAdmin(m)) return m.reply('❌ Only admins can use this');
      if (!botData.disabled.includes(c)) {
        botData.disabled.push(c);
        save();
      }
      return m.reply('🚫 Commands disabled in this channel');
    }
    case 'enable': {
      if (!isAdmin(m)) return m.reply('❌ Only admins can use this');
      botData.disabled = botData.disabled.filter(ch => ch !== c);
      save();
      return m.reply('✅ Commands enabled in this channel');
    }
    case 'bully': {
      if (!isAdmin(m) || !m.mentions.users.first()) return m.reply('❌ Usage: -bully @user');
      const target = m.mentions.users.first();
      for (let i = 0; i < 8; i++) {
        await m.channel.send(`${target} 👊`).catch(() => {});
        await delay(600);
      }
      return;
    }
    case 'dw': {
      const opponent = m.mentions.users.first() || { username: 'Opponent' };
      const rounds = Math.max(1, Math.min(10, parseInt(args[1]) || 5));
      const sides = Math.max(2, Math.min(20, parseInt(args[2]) || 6));
      let p1 = 0, p2 = 0;
      await m.reply(`🎲 Dice War: ${m.author.username} vs ${opponent.username}`);
      for (let i = 1; i <= rounds; i++) {
        const r1 = Math.floor(Math.random() * sides) + 1;
        const r2 = Math.floor(Math.random() * sides) + 1;
        if (r1 > r2) p1++;
        else if (r2 > r1) p2++;
        await m.channel.send(`Round ${i}: ${r1} - ${r2} | Score: ${p1} - ${p2}`).catch(() => {});
        await delay(900);
      }
      const result = p1 > p2 ? `✅ ${m.author.username} wins!` : p2 > p1 ? `✅ ${opponent.username} wins!` : '⚖️ It\'s a draw!';
      return m.channel.send(`🏆 Final Score: ${p1} - ${p2}\n${result}`);
    }
    case 'cw': {
      const opponent = m.mentions.users.first();
      const side = args[1]?.toLowerCase();
      if (!opponent || !['heads', 'tails'].includes(side)) return m.reply('❌ Usage: -cw @user heads/tails');
      let userScore = 0, oppScore = 0;
      await m.reply(`🪙 Coin War: ${m.author.username} vs ${opponent.username}`);
      while (userScore < 2 && oppScore < 2) {
        const flip = Math.random() < 0.5 ? 'Heads' : 'Tails';
        if (flip.toLowerCase() === side) userScore++;
        else oppScore++;
        await m.channel.send(`Flip: ${flip} | Score: ${userScore} - ${oppScore}`).catch(() => {});
        await delay(900);
      }
      return m.channel.send(userScore === 2 ? `🏆 ${m.author.username} wins!` : `🏆 ${opponent.username} wins!`);
    }
    case 'help': {
      return m.reply(`📖 **COMMANDS**

💰 **REWARDS**
\`-rewardtoggle\` (Owner only)
\`-setreward <msgs> <amount>\` (Owner only)
\`-balance\` / \`-balance @user\`
\`-earningslb\`

🎲 **GENERAL**
\`-d [max]\` • \`-cf\` • \`-choose\`
\`-ship @user1 @user2\` • \`-stats\`
\`-dw [rounds] [sides]\` • \`-cw @user heads/tails\`

👑 **ADMIN**
\`-disable\` • \`-enable\` • \`-bully @user\`

🔒 **OWNER**
\`-silence\`
`);
    }
  }
});

client.login(token).catch(err => console.error('❌ Login failed:', err.message));
