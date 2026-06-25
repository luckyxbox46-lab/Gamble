const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) { console.error('❌ DISCORD_BOT_TOKEN missing!'); process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ]
});

// --------------------------
// SETTINGS
// --------------------------
const PREFIX = '-';
const OWNER_USERNAME = '.luckyyy_';
const CD = 15000;
const MIN_MESSAGE_LENGTH = 3;
const MIN_TIME_BETWEEN = 2000;
let REWARD_THRESH = 10000;
let REWARD_AMT = 2;
const userCd = new Map(), lastMsg = new Map(), lastMsgTime = new Map();
const delay = ms => new Promise(r => setTimeout(r, ms));

const formatNum = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'm';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toString();
};

// --------------------------
// DATA STORAGE
// --------------------------
const DATA_DIR = './persist';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, 'bot-data.json');

let botData = {
  disabledChannels: [],
  silenceMode: {},
  rewardsEnabled: {},
  blockedUsers: [],
  balances: {},
  rewardCfg: { t: 10000, a: 2 }
};

if (fs.existsSync(DATA_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    botData = { ...botData, ...loaded };
    console.log('✅ Loaded saved data');
  } catch {
    console.log('⚠️ Starting fresh data');
  }
}

REWARD_THRESH = botData.rewardCfg.t || 10000;
REWARD_AMT = botData.rewardCfg.a || 2;

const saveData = () => {
  botData.rewardCfg = { t: REWARD_THRESH, a: REWARD_AMT };
  fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2), 'utf8');
  console.log('💾 Saved');
};

// --------------------------
// HELPERS
// --------------------------
function parseTime(input) {
  const match = input.match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  switch(match[2].toLowerCase()) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

const isOwner = m => m.author.username === OWNER_USERNAME;
const isAdmin = m => m.member?.permissions.has(PermissionsBitField.Flags.Administrator);
const isBlocked = id => botData.blockedUsers?.includes(id) || false;

function isSpam(content) {
  if (!content) return true;
  const clean = content.replace(/[\s!?.,~*_+=<>:"'|\\/[\]{}()@#$%^&-]/g, '');
  return clean.length < MIN_MESSAGE_LENGTH || /^(.)\1+$/.test(clean);
}

// --------------------------
// READY EVENT
// --------------------------
client.once('clientReady', () => console.log(`✅ Bot online: ${client.user.tag}`));

// --------------------------
// ONLY ONE MESSAGE LISTENER
// --------------------------
client.on('messageCreate', async m => {
  if (!m.guild || m.author.bot) return;

  const g = m.guild.id;
  const u = m.author.id;
  const content = m.content.trim();

  // Reward system
  if (botData.rewardsEnabled[g] !== false && !content.startsWith(PREFIX) && !isSpam(content)) {
    const now = Date.now();
    if (now - (lastMsgTime.get(u) || 0) > MIN_TIME_BETWEEN && content !== lastMsg.get(u)) {
      if (!botData.balances[u]) botData.balances[u] = { count: 0, earned: 0 };
      botData.balances[u].count++;
      lastMsg.set(u, content);
      lastMsgTime.set(u, now);
      const earned = Math.floor(botData.balances[u].count / REWARD_THRESH) * REWARD_AMT;
      if (earned > botData.balances[u].earned) {
        botData.balances[u].earned = earned;
        saveData();
      }
    }
    return;
  }

  // Only process commands once
  if (!content.startsWith(PREFIX)) return;

  if (isBlocked(u)) return m.reply({ content: '🚫 You are blocked.', ephemeral: true }).catch(() => {});
  if (botData.silenceMode?.[g] && !isOwner(m)) return;
  if (botData.disabledChannels?.includes(m.channel.id) && !isAdmin(m)) return;

  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  // Cooldown
  if (!['d','cf','choose','help'].includes(cmd) && !isOwner(m)) {
    const lastUsed = userCd.get(u) || 0;
    if (Date.now() - lastUsed < CD) {
      return m.reply(`⏳ Wait ${Math.ceil((CD - (Date.now() - lastUsed))/1000)}s`).catch(() => {});
    }
    userCd.set(u, Date.now());
  }

  // --------------------------
  // ALL COMMANDS — NO DUPLICATES
  // --------------------------
  switch (cmd) {
    case 'd': {
      const max = parseInt(args[0]) || 100;
      return m.reply(`🎲 Roll: **${Math.floor(Math.random() * max) + 1}**`);
    }
    case 'cf': {
      return m.reply(`🪙 Flip: **${Math.random() < 0.5 ? 'Heads' : 'Tails'}**`);
    }
    case 'choose': {
      if (!args.length) return m.reply('❌ Usage: `-choose opt1 opt2 ...`');
      return m.reply(`🤔 I pick: **${args[Math.floor(Math.random() * args.length)]}**`);
    }
    case 'ship': {
      const u1 = m.mentions.users.at(0), u2 = m.mentions.users.at(1) || m.author;
      if (!u1) return m.reply('❌ Usage: `-ship @User1 [@User2]`');
      const percent = Math.floor(Math.random() * 101);
      const color = percent > 70 ? '#e91e63' : percent > 40 ? '#f39c12' : '#3498db';
      return m.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('💞 Compatibility').setDescription(`**${u1.username}** × **${u2.username}**\nMatch: **${percent}%**`)] });
    }
    case 'dw': {
      const opponent = m.mentions.users.first();
      if (!opponent) return m.reply('❌ Usage: `-dw @User [rounds] [max]`');
      const rounds = Math.max(1, Math.min(10, parseInt(args[1]) || 5));
      const sides = Math.max(2, parseInt(args[2]) || 1000);
      let score1 = 0, score2 = 0;
      await m.reply(`🎲 **Dice War**: ${m.author.username} vs ${opponent.username}\n• Rounds: ${rounds}\n• Max: ${sides.toLocaleString()}`);
      for (let i = 1; i <= rounds; i++) {
        const r1 = Math.floor(Math.random() * sides) + 1;
        const r2 = Math.floor(Math.random() * sides) + 1;
        if (r1 > r2) score1++;
        if (r2 > r1) score2++;
        await m.channel.send(`Round ${i}: 🎲 ${r1.toLocaleString()} vs ${r2.toLocaleString()}`).catch(() => {});
        await delay(900);
      }
      const result = score1 > score2 ? `🏆 **${m.author.username} wins!**` : score2 > score1 ? `🏆 **${opponent.username} wins!**` : `⚖️ Draw!`;
      return m.channel.send(`Final: **${score1} - ${score2}**\n${result}`);
    }
    case 'cw': {
      const opponent = m.mentions.users.first();
      const pick = args.find(a => ['heads','tails'].includes(a.toLowerCase()))?.toLowerCase();
      if (!opponent || !pick) return m.reply('❌ Usage: `-cw @User heads/tails`');
      let s1 = 0, s2 = 0;
      await m.reply(`🪙 **Coin War**: ${m.author.username} vs ${opponent.username}\nYou chose: **${pick.toUpperCase()}**`);
      while (s1 < 2 && s2 < 2) {
        const flip = Math.random() < 0.5 ? 'heads' : 'tails';
        flip === pick ? s1++ : s2++;
        await m.channel.send(`Flip: **${flip.toUpperCase()}** | Score: ${s1} - ${s2}`).catch(() => {});
        await delay(900);
      }
      return m.channel.send(`🏆 Winner: **${s1 === 2 ? m.author.username : opponent.username}**`);
    }
    case 'bully': {
      if (!isAdmin(m)) return m.reply('❌ Admin only.');
      const target = m.mentions.users.first();
      if (!target) return m.reply('❌ Usage: `-bully @User`');
      const roasts = [
        "You’re the reason they put instructions on shampoo bottles 🧴",
        "If brains were dynamite, you wouldn’t have enough to blow your nose 💣",
        "You bring everyone so much joy… when you leave the room 😂",
        "I’d agree with you but then we’d both be wrong 🤡",
        "You have something on your chin… no, the third one down 🤨"
      ];
      for (const line of roasts.sort(() => 0.5 - Math.random()).slice(0, 5)) {
        await m.channel.send(`${target} ${line}`).catch(() => {});
        await delay(700);
      }
      return;
    }
    case 'rewardtoggle': {
      if (!isOwner(m)) return m.reply('❌ Owner only.');
      botData.rewardsEnabled[g] = !botData.rewardsEnabled[g];
      saveData();
      return m.reply(`✅ Rewards: **${botData.rewardsEnabled[g] ? 'ENABLED' : 'DISABLED'}**`);
    }
    case 'setreward': {
      if (!isOwner(m)) return m.reply('❌ Owner only.');
      const t = parseInt(args[0]), a = parseFloat(args[1]);
      if (!t || !a) return m.reply('❌ Usage: `-setreward <messages> <amount>`');
      REWARD_THRESH = t; REWARD_AMT = a; saveData();
      return m.reply(`✅ Set: ${formatNum(t)} messages = $${a.toFixed(2)}`);
    }
    case 'balance': {
      const target = m.mentions.users.first() || m.author;
      if (m.mentions.users.first() && !isAdmin(m)) return m.reply('❌ Only admins can check others.');
      const data = botData.balances[target.id] || { count: 0, earned: 0 };
      return m.reply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setTitle(`💰 Balance — ${target.username}`).addFields(
        { name: 'Messages', value: formatNum(data.count), inline: true },
        { name: 'Earned', value: `$${data.earned.toFixed(2)}`, inline: true }
      )] });
    }
    case 'earningslb': {
      const sorted = Object.entries(botData.balances).sort((a,b) => b[1].count - a[1].count).slice(0, 10);
      if (!sorted.length) return m.reply('📊 No data yet.');
      let desc = '';
      for (let i = 0; i < sorted.length; i++) {
        const user = await client.users.fetch(sorted[i][0]).catch(() => ({ username: 'Unknown' }));
        desc += `**${i+1}.** ${user.username} • ${formatNum(sorted[i][1].count)} • $${sorted[i][1].earned.toFixed(2)}\n`;
      }
      return m.reply({ embeds: [new EmbedBuilder().setColor('#f1c40f').setTitle('🏆 Leaderboard').setDescription(desc)] });
    }
    case 'gw': case 'giveaway': {
      if (!isAdmin(m)) return m.reply('❌ Admin only.');
      if (args.length < 4) return m.reply('❌ Usage: `-gw <prize> <time> <requirements> <host>`');
      const prize = args[0], timeStr = args[1], reqs = args.slice(2, -1).join(' '), host = args.at(-1);
      const dur = parseTime(timeStr);
      if (!dur) return m.reply('❌ Time: e.g. 1m, 5m, 1h');
      const end = Math.floor((Date.now() + dur) / 1000);
      const embed = new EmbedBuilder().setColor('#FF9900').setTitle('🎉 GIVEAWAY').setDescription('React with ✅ to enter').addFields(
        { name: 'Prize', value: prize },
        { name: 'Time', value: timeStr, inline: true },
        { name: 'Host', value: host, inline: true },
        { name: 'Ends', value: `<t:${end}:R>` }
      );
      const msg = await m.channel.send({ embeds: [embed] });
      await msg.react('✅');
      setTimeout(async () => {
        try {
          const fetched = await msg.fetch();
          const users = await fetched.reactions.cache.get('✅').users.fetch();
          const entries = users.filter(u => !u.bot);
          if (!entries.size) return fetched.reply('❌ No participants.');
          fetched.reply(`🎊 Winner: ${entries.random()}!`);
        } catch {}
      }, dur);
      return;
    }
    case 'reroll': {
      if (!isAdmin(m)) return m.reply('❌ Admin only.');
      const mid = args[0];
      if (!mid) return m.reply('❌ `-reroll <messageID>`');
      try {
        const msg = await m.channel.messages.fetch(mid);
        const users = await msg.reactions.cache.get('✅').users.fetch();
        const entries = users.filter(u => !u.bot);
        if (!entries.size) return m.reply('❌ No entries.');
        return msg.reply(`🔄 New winner: ${entries.random()}`);
      } catch { return m.reply('❌ Message not found.'); }
    }
    case 'silence': {
      if (!isOwner(m)) return m.reply('❌ Owner only.');
      botData.silenceMode[g] = !botData.silenceMode[g];
      saveData();
      return m.reply(`🔇 Silence: **${botData.silenceMode[g] ? 'ON' : 'OFF'}**`);
    }
    case 'ignore': {
      if (!isAdmin(m)) return m.reply('❌ Admin only.');
      const target = m.mentions.users.first();
      if (!target) return m.reply('❌ `-ignore @User`');
      if (isBlocked(target.id)) return m.reply('ℹ️ Already blocked.');
      botData.blockedUsers.push(target.id);
      saveData();
      return m.reply(`✅ Blocked ${target.username}`);
    }
    case 'unignore': {
      if (!isAdmin(m)) return m.reply('❌ Admin only.');
      const target = m.mentions.users.first();
      if (!target) return m.reply('❌ `-unignore @User`');
      if (!isBlocked(target.id)) return m.reply('ℹ️ Not blocked.');
      botData.blockedUsers = botData.blockedUsers.filter(id => id !== target.id);
      saveData();
      return m.reply(`✅ Unblocked ${target.username}`);
    }
    case 'disable': {
      if (!isAdmin(m)) return m.reply('❌ Admin only.');
      const cid = m.channel.id;
      if (botData.disabledChannels.includes(cid)) return m.reply('ℹ️ Already disabled here.');
      botData.disabledChannels.push(cid);
      saveData();
      return m.reply('🚫 Commands disabled here.');
    }
    case 'enable': {
      if (!isAdmin(m)) return m.reply('❌ Admin only.');
      const cid = m.channel.id;
      if (!botData.disabledChannels.includes(cid)) return m.reply('ℹ️ Already enabled here.');
      botData.disabledChannels = botData.disabledChannels.filter(id => id !== cid);
      saveData();
      return m.reply('✅ Commands enabled here.');
    }
    case 'help': {
      return m.reply({ embeds: [new EmbedBuilder().setColor('#6A5ACD').setTitle('✨ LUCKY\'S COMMAND CENTER ✨').setDescription('All commands you can use — have fun! 🎉').addFields(
        { name: '🎮 FUN & GAMES', value: '`-d [max]` → Roll the dice\n`-cf` → Flip a coin\n`-choose <...>` → Let me pick for you\n`-ship @user [@user2]` → Check your match!\n`-dw @user [rounds] [max]` → Dice War challenge\n`-cw @user heads/tails` → Coin War battle\n`-bully @user` → Send some friendly chaos' },
        { name: '💰 REWARDS & STATS', value: '`-balance [@user]` → Check your messages & earnings\n`-earningslb` → View the server leaderboard\n`-rewardtoggle` → Turn rewards ON/OFF\n`-setreward <msgs> <amount>` → Set reward rate' },
        { name: '🎉 GIVEAWAYS', value: '`-gw / -giveaway` → Start a giveaway\n`-reroll <messageID>` → Pick a new winner' },
        { name: '⚙️ ADMIN CONTROLS', value: '`-silence` → Mute/unmute all commands\n`-ignore @user` → Block user from using commands\n`-unignore @user` → Unblock user\n`-disable` → Turn off commands in this channel\n`-enable` → Turn commands back on' }
      ).setFooter({ text: `Prefix: ${PREFIX} | Owner: ${OWNER_USERNAME}` })] });
    }
    default:
      return m.reply('❌ Unknown command. Type `-help` to see what I can do!').catch(() => {});
  }
});

client.login(token);
