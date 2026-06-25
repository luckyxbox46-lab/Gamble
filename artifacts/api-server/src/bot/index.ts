const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  AttachmentBuilder
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
// MESSAGE HANDLER — ONLY ONE LISTENER
// --------------------------
client.on('messageCreate', async m => {
  if (!m.guild || m.author.bot) return;

  const g = m.guild.id;
  const u = m.author.id;
  const content = m.content.trim();

  // Reward system logic
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

  // Only process commands if they start with prefix
  if (!content.startsWith(PREFIX)) return;

  // Permission checks
  if (isBlocked(u)) return m.reply({ content: '🚫 You are blocked from using commands.', ephemeral: true }).catch(() => {});
  if (botData.silenceMode?.[g] && !isOwner(m)) return;
  if (botData.disabledChannels?.includes(m.channel.id) && !isAdmin(m)) return;

  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  // Cooldown check
  if (!['d','cf','choose','help'].includes(cmd) && !isOwner(m)) {
    const lastUsed = userCd.get(u) || 0;
    if (Date.now() - lastUsed < CD) {
      return m.reply(`⏳ Please wait ${Math.ceil((CD - (Date.now() - lastUsed))/1000)}s before using this command again.`).catch(() => {});
    }
    userCd.set(u, Date.now());
  }

  // --------------------------
  // ALL COMMANDS
  // --------------------------
  switch (cmd) {
    case 'd': {
      const max = parseInt(args[0]) || 100;
      return m.reply(`🎲 Roll result: **${Math.floor(Math.random() * max) + 1}**`);
    }
    case 'cf': {
      return m.reply(`🪙 Coin flip: **${Math.random() < 0.5 ? 'Heads' : 'Tails'}**`);
    }
    case 'choose': {
      if (!args.length) return m.reply('❌ Usage: `-choose option1 option2 ...`');
      return m.reply(`🤔 I choose: **${args[Math.floor(Math.random() * args.length)]}**`);
    }
    case 'ship': {
      const u1 = m.mentions.users.at(0);
      const u2 = m.mentions.users.at(1) || m.author;
      if (!u1) return m.reply('❌ Usage: `-ship @User1 [@User2]`');
      const percent = Math.floor(Math.random() * 101);
      const color = percent > 70 ? '#e91e63' : percent > 40 ? '#f39c12' : '#3498db';
      return m.reply({
        embeds: [new EmbedBuilder()
          .setColor(color)
          .setTitle('💞 Compatibility')
          .setDescription(`**${u1.username}** × **${u2.username}**\nMatch: **${percent}%**`)]
      });
    }
    case 'dw': {
      const opponent = m.mentions.users.first();
      if (!opponent) return m.reply('❌ Usage: `-dw @User [rounds] [max]`');
      const rounds = Math.max(1, Math.min(10, parseInt(args[1]) || 5));
      const sides = Math.max(2, parseInt(args[2]) || 1000);
      let score1 = 0, score2 = 0;
      await m.reply(`🎲 **Dice War**: ${m.author.username} vs ${opponent.username}\n• Rounds: ${rounds}\n• Max value: ${sides.toLocaleString()}`);
      for (let i = 1; i <= rounds; i++) {
        const r1 = Math.floor(Math.random() * sides) + 1;
        const r2 = Math.floor(Math.random() * sides) + 1;
        if (r1 > r2) score1++;
        if (r2 > r1) score2++;
        await m.channel.send(`Round ${i}: 🎲 ${r1.toLocaleString()} vs ${r2.toLocaleString()}`).catch(() => {});
        await delay(900);
      }
      const result = score1 > score2 ? `🏆 **${m.author.username} wins!**` : score2 > score1 ? `🏆 **${opponent.username} wins!**` : `⚖️ It's a draw!`;
      return m.channel.send(`Final Score: **${score1} - ${score2}**\n${result}`);
    }
    case 'cw': {
      const opponent = m.mentions.users.first();
      const pick = args.find(a => ['heads','tails'].includes(a.toLowerCase()))?.toLowerCase();
      if (!opponent || !pick) return m.reply('❌ Usage: `-cw @User heads/tails`');
      let s1 = 0, s2 = 0;
      await m.reply(`🪙 **Coin War**: ${m.author.username} vs ${opponent.username}\nYour choice: **${pick.toUpperCase()}**`);
      while (s1 < 2 && s2 < 2) {
        const flip = Math.random() < 0.5 ? 'heads' : 'tails';
        flip === pick ? s1++ : s2++;
        await m.channel.send(`Flip: **${flip.toUpperCase()}** | Score: ${s1} - ${s2}`).catch(() => {});
        await delay(900);
      }
      return m.channel.send(`🏆 Winner: **${s1 === 2 ? m.author.username : opponent.username}**`);
    }
    case 'bully': {
      if (!isAdmin(m)) return m.reply('❌ This command is for admins only.');
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
      if (!isOwner(m)) return m.reply('❌ Only the bot owner can use this.');
      botData.rewardsEnabled[g] = !botData.rewardsEnabled[g];
      saveData();
      return m.reply(`✅ Message rewards are now **${botData.rewardsEnabled[g] ? 'ENABLED' : 'DISABLED'}**`);
    }
    case 'setreward': {
      if (!isOwner(m)) return m.reply('❌ Only the bot owner can use this.');
      const t = parseInt(args[0]), a = parseFloat(args[1]);
      if (!t || !a || t < 1) return m.reply('❌ Usage: `-setreward <messages> <amount>`');
      REWARD_THRESH = t; REWARD_AMT = a; saveData();
      return m.reply(`✅ Reward set: **${formatNum(t)} messages = $${a.toFixed(2)}**`);
    }
    case 'balance': {
      const target = m.mentions.users.first() || m.author;
      if (m.mentions.users.first() && !isAdmin(m)) return m.reply('❌ Only admins can check other users.');
      const data = botData.balances[target.id] || { count: 0, earned: 0 };
      return m.reply({
        embeds: [new EmbedBuilder()
          .setColor('#2ecc71')
          .setTitle(`💰 Balance — ${target.username}`)
          .addFields(
            { name: 'Total Messages', value: formatNum(data.count), inline: true },
            { name: 'Total Earned', value: `$${data.earned.toFixed(2)}`, inline: true }
          )]
      });
    }
    case 'earningslb': {
      const sorted = Object.entries(botData.balances).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
      if (!sorted.length) return m.reply('📊 No activity data recorded yet.');
      let desc = '';
      for (let i = 0; i < sorted.length; i++) {
        const user = await client.users.fetch(sorted[i][0]).catch(() => ({ username: 'Unknown User' }));
        desc += `**${i + 1}.** ${user.username} • ${formatNum(sorted[i][1].count)} messages • $${sorted[i][1].earned.toFixed(2)}\n`;
      }
      return m.reply({
        embeds: [new EmbedBuilder()
          .setColor('#f1c40f')
          .setTitle('🏆 Leaderboard')
          .setDescription(desc)]
      });
    }
    case 'gw': case 'giveaway': {
      if (!isAdmin(m)) return m.reply('❌ This command is for admins only.');
      if (args.length < 4) return m.reply('❌ Usage: `-gw <prize> <time> <requirements> <host>`\nExample: `-gw 100 Coins 5m Must be active @luckyyy`\nTime units: s = seconds, m = minutes, h = hours, d = days');
      const prize = args[0];
      const timeStr = args[1];
      const requirements = args.slice(2, -1).join(' ');
      const host = args.at(-1);
      const duration = parseTime(timeStr);
      if (!duration) return m.reply('❌ Invalid time format — use e.g. `30s`, `10m`, `2h`');
      const endTimestamp = Math.floor((Date.now() + duration) / 1000);
      const embed = new EmbedBuilder()
        .setColor('#FF9900')
        .setTitle('🎉 GIVEAWAY')
        .setDescription('React with ✅ below to enter!')
        .addFields(
          { name: '🏆 Prize', value: prize, inline: false },
          { name: '⏱️ Duration', value: timeStr, inline: true },
          { name: '📋 Requirements', value: requirements, inline: true },
          { name: '👤 Hosted by', value: host, inline: true },
          { name: '📅 Ends', value: `<t:${endTimestamp}:R>`, inline: false }
        )
        .setTimestamp(Date.now() + duration);
      const giveawayMsg = await m.channel.send({ embeds: [embed] });
      await giveawayMsg.react('✅');
      m.reply('✅ Giveaway started successfully!');
      setTimeout(async () => {
        try {
          const fetched = await giveawayMsg.fetch();
          const reactions = fetched.reactions.cache.get('✅');
          if (!reactions) return fetched.reply('❌ No reaction data found.');
          const users = await reactions.users.fetch();
          const participants = users.filter(u => !u.bot);
          if (!participants.size) return fetched.reply('❌ No one entered the giveaway.');
          const winner = participants.random();
          fetched.reply(`🎊 **GIVEAWAY ENDED!** 🎊\n🏆 Prize: **${prize}**\n👑 Winner: ${winner}\n📩 Please contact ${host} to claim your reward!`);
        } catch (err) {
          console.error('Giveaway error:', err);
        }
      }, duration);
      return;
    }
    case 'reroll': {
      if (!isAdmin(m)) return m.reply('❌ This command is for admins only.');
      const messageId = args[0];
      if (!messageId) return m.reply('❌ Usage: `-reroll <giveaway_message_id>`');
      try {
        const msg = await m.channel.messages.fetch(messageId);
        const reactions = msg.reactions.cache.get('✅');
        if (!reactions) return m.reply('❌ No entries found for this giveaway.');
        const users = await reactions.users.fetch();
        const participants = users.filter(u => !u.bot);
        if (!participants.size) return m.reply('❌ No valid participants.');
        const newWinner = participants.random();
        return msg.reply(`🔄 **Giveaway Rerolled!**\n🏆 New winner: ${newWinner}`);
      } catch {
        return m.reply('❌ Could not find that message — check the ID and permissions.');
      }
    }
    case 'silence': {
      if (!isOwner(m) && !m.guild.ownerId === u) return m.reply('❌ Not enough permissions.');
      botData.silenceMode[g] = !botData.silenceMode[g];
      saveData();
      return m.reply(`🔇 Command silence mode: **${botData.silenceMode[g] ? 'ON' : 'OFF'}**`);
    }
    case 'ignore': {
      if (!isAdmin(m)) return m.reply('❌ Admin only.');
      const target = m.mentions.users.first();
      if (!target) return m.reply('❌ Usage: `-ignore @User`');
      if (isBlocked(target.id)) return m.reply(`ℹ️ ${target.username} is already blocked.`);
      if (!botData.blockedUsers) botData.blockedUsers = [];
      botData.blockedUsers.push(target.id);
      saveData();
      return m.reply(`✅ ${target.username} has been blocked from commands.`);
    }
    case 'unignore': {
      if (!isAdmin(m)) return m.reply('❌ Admin only.');
      const target = m.mentions.users.first();
      if (!target) return m.reply('❌ Usage: `-unignore @User`');
      if (!isBlocked(target.id)) return m.reply(`ℹ️ ${target.username} is not blocked.`);
      botData.blockedUsers = botData.blockedUsers.filter(id => id !== target.id);
      saveData();
      return m.reply(`✅ ${target.username} has been unblocked.`);
    }
    case 'disable': {
      if (!isAdmin(m)) return m.reply('❌ Admin only.');
      const channelId = m.channel.id;
      if (!botData.disabledChannels) botData.disabledChannels = [];
      if (botData.disabledChannels.includes(channelId)) return m.reply('ℹ️ Commands are already disabled here.');
      botData.disabledChannels.push(channelId);
      saveData();
      return m.reply('🚫 Commands have been disabled in this channel.');
    }
    case 'enable': {
      if (!isAdmin(m)) return m.reply('❌ Admin only.');
      const channelId = m.channel.id;
      if (!botData.disabledChannels?.includes(channelId)) return m.reply('ℹ️ Commands are already enabled here.');
      botData.disabledChannels = botData.disabledChannels.filter(id => id !== channelId);
      saveData();
      return m.reply('✅ Commands have been enabled in this channel.');
    }
    case 'help': {
      return m.reply({
        embeds: [new EmbedBuilder()
          .setColor('#6A5ACD')
          .setTitle('✨ Bot Commands')
          .setDescription(`Prefix: **${PREFIX}** | Owner: **${OWNER_USERNAME}**`)
          .addFields(
            { name: '🎮 Fun & Games', value: '`-d`, `-cf`, `-choose`, `-ship`, `-dw`, `-cw`, `-bully`' },
            { name: '💰 Economy', value: '`-balance`, `-earningslb`, `-rewardtoggle`, `-setreward`' },
            { name: '🎉 Giveaways', value: '`-gw`, `-giveaway`, `-reroll`' },
            { name: '⚙️ Admin Tools', value: '`-silence`, `-ignore`, `-unignore`, `-disable`, `-enable`' }
          )]
      });
    }
    default:
      return m.reply('❌ Unknown command. Type `-help` to see all available commands.').catch(() => {});
  }
});

client.login(token);
