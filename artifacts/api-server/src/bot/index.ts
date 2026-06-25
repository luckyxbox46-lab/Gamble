const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// ⚠️ ONLY uses environment variable — NEVER hardcode your token!
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) { console.error('❌ DISCORD_BOT_TOKEN missing!'); process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions // REQUIRED for giveaways
  ]
});

// --------------------------
// SETTINGS
// --------------------------
const PREFIX = '-';
const OWNER_USERNAME = '.luckyyy_';
const COOLDOWN = 15000;
const MIN_MESSAGE_LENGTH = 3;
const MIN_TIME_BETWEEN_MESSAGES = 2000;
let REWARD_THRESHOLD = 10000;
let REWARD_AMOUNT = 2;

const userCooldowns = new Map();
const lastUserMessage = new Map();
const lastUserMessageTime = new Map();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const formatNumber = (num) => {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'm';
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return num.toString();
};

// --------------------------
// DATA STORAGE
// --------------------------
const DATA_FOLDER = '/persist';
const DATA_FILE = path.join(DATA_FOLDER, 'bot-data.json');
if (!fs.existsSync(DATA_FOLDER)) fs.mkdirSync(DATA_FOLDER, { recursive: true });

const defaultData = {
  disabledChannels: [],
  silenceMode: {},
  rewardsEnabled: {},
  blockedUsers: [],
  balances: {},
  rewardConfig: { threshold: 10000, amount: 2 }
};

let botData;
if (fs.existsSync(DATA_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    botData = { ...defaultData, ...saved };
    console.log('✅ Loaded saved data');
  } catch {
    console.log('⚠️ Starting fresh data');
    botData = { ...defaultData };
  }
} else {
  botData = { ...defaultData };
}

REWARD_THRESHOLD = botData.rewardConfig.threshold || 10000;
REWARD_AMOUNT = botData.rewardConfig.amount || 2;

const saveData = () => {
  botData.rewardConfig = { threshold: REWARD_THRESHOLD, amount: REWARD_AMOUNT };
  fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2), 'utf8');
};

// --------------------------
// HELPERS
// --------------------------
const isBotOwner = member => member.author.username === OWNER_USERNAME;
const isServerOwner = member => member.guild && member.guild.ownerId === member.author.id;
const isAdmin = member => member.member?.permissions?.has(PermissionsBitField.Flags.Administrator);
const isBlocked = userId => botData.blockedUsers.includes(userId);
const isSpam = content => !content || content.replace(/\W/g, '').length < MIN_MESSAGE_LENGTH || /^(.)\1+$/.test(content);

// Time parser for giveaways
const parseTime = input => {
  const match = input.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  return {
    s: value * 1000,
    m: value * 60 * 1000,
    h: value * 60 * 60 * 1000,
    d: value * 24 * 60 * 60 * 1000
  }[unit] || null;
};

client.once('ready', () => console.log(`✅ Bot online: ${client.user.tag}`));

// --------------------------
// MESSAGE HANDLER
// --------------------------
client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  const content = message.content.trim();

  // Initialize guild settings
  if (botData.rewardsEnabled[guildId] === undefined) {
    botData.rewardsEnabled[guildId] = true;
    saveData();
  }

  // Message counting & rewards
  if (botData.rewardsEnabled[guildId] && !content.startsWith(PREFIX) && !isSpam(content)) {
    const now = Date.now();
    if (now - (lastUserMessageTime.get(userId) || 0) > MIN_TIME_BETWEEN_MESSAGES && content !== lastUserMessage.get(userId)) {
      if (!botData.balances[userId]) botData.balances[userId] = { count: 0, earned: 0 };
      botData.balances[userId].count++;
      lastUserMessage.set(userId, content);
      lastUserMessageTime.set(userId, now);
      const earned = Math.floor(botData.balances[userId].count / REWARD_THRESHOLD) * REWARD_AMOUNT;
      if (earned > botData.balances[userId].earned) {
        botData.balances[userId].earned = earned;
        saveData();
      }
    }
  }

  // Only process commands
  if (!content.startsWith(PREFIX)) return;

  if (isBlocked(userId)) return message.reply({ content: '🚫 You are blocked from using commands.', ephemeral: true }).catch(() => {});
  if (botData.silenceMode[guildId] && !isBotOwner(message) && !isServerOwner(message)) return;
  if (botData.disabledChannels.includes(message.channel.id) && !isAdmin(message)) return;

  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // Cooldown
  if (!['d', 'cf', 'choose', 'help', 'gw', 'giveaway', 'reroll'].includes(command) && !isBotOwner(message)) {
    const lastUsed = userCooldowns.get(userId) || 0;
    if (Date.now() - lastUsed < COOLDOWN) {
      return message.reply(`⏳ Wait ${Math.ceil((COOLDOWN - (Date.now() - lastUsed)) / 1000)}s`).catch(() => {});
    }
    userCooldowns.set(userId, Date.now());
  }

  // --------------------------
  // ALL COMMANDS
  // --------------------------
  switch (command) {
    case 'd': {
      const max = parseInt(args[0]) || 100;
      const roll = Math.floor(Math.random() * max) + 1;
      return message.reply(`🎲 Roll: **${roll}**`);
    }

    case 'cf': {
      const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
      return message.reply(`🪙 Flip: **${result}**`);
    }

    case 'rewardtoggle': {
      if (!isBotOwner(message)) return message.reply({ content: '❌ Only bot owner can use this.', ephemeral: true });
      botData.rewardsEnabled[guildId] = !botData.rewardsEnabled[guildId];
      saveData();
      return message.reply(`✅ Rewards: **${botData.rewardsEnabled[guildId] ? 'ENABLED' : 'DISABLED'}**`);
    }

    case 'setreward': {
      if (!isBotOwner(message)) return message.reply({ content: '❌ Only bot owner can use this.', ephemeral: true });
      const threshold = parseInt(args[0]);
      const amount = parseFloat(args[1]);
      if (!threshold || !amount || threshold < 1) return message.reply('❌ Usage: `-setreward <messages> <amount>`');
      REWARD_THRESHOLD = threshold;
      REWARD_AMOUNT = amount;
      saveData();
      return message.reply(`✅ Updated: **${formatNumber(threshold)} messages = $${amount.toFixed(2)}**`);
    }

    case 'balance': {
      const target = message.mentions.users.first() || message.author;
      if (message.mentions.users.first() && !isAdmin(message)) return message.reply({ content: '❌ Only admins can check others.', ephemeral: true });
      const data = botData.balances[target.id] || { count: 0, earned: 0 };
      const nextReward = (Math.floor(data.count / REWARD_THRESHOLD) + 1) * REWARD_THRESHOLD;

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`💰 Balance — ${target.username}`)
        .addFields(
          { name: 'Total Messages', value: formatNumber(data.count), inline: true },
          { name: 'Total Earned', value: `$${data.earned.toFixed(2)}`, inline: true },
          { name: 'Next Reward At', value: formatNumber(nextReward), inline: true }
        );
      return message.reply({ embeds: [embed] });
    }

    case 'earningslb': {
      if (botData.rewardsEnabled[guildId] !== true) return message.reply('❌ Rewards are disabled.');
      const sorted = Object.entries(botData.balances).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
      if (!sorted.length) return message.reply('📊 No data yet.');

      let description = '';
      for (let i = 0; i < sorted.length; i++) {
        const [id, stats] = sorted[i];
        try {
          const user = await client.users.fetch(id);
          description += `**${i+1}.** ${user.username} • ${formatNumber(stats.count)} • $${stats.earned.toFixed(2)}\n`;
        } catch {
          description += `**${i+1}.** Unknown • ${formatNumber(stats.count)} • $${stats.earned.toFixed(2)}\n`;
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle('🏆 Leaderboard')
        .setDescription(description);
      return message.reply({ embeds: [embed] });
    }

    case 'silence': {
      if (!isBotOwner(message) && !isServerOwner(message)) return message.reply({ content: '❌ Only owner can use this.', ephemeral: true });
      botData.silenceMode[guildId] = !botData.silenceMode[guildId];
      saveData();
      return message.reply(botData.silenceMode[guildId] ? '🔇 Commands muted' : '🔊 Commands enabled');
    }

    case 'ignore': {
      if (!isAdmin(message)) return message.reply({ content: '❌ Only admins can use this.', ephemeral: true });
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Usage: `-ignore @user`');
      if (isBotOwner({ author: target })) return message.reply('❌ Cannot ignore bot owner.');
      if (!botData.blockedUsers.includes(target.id)) {
        botData.blockedUsers.push(target.id);
        saveData();
      }
      return message.reply(`✅ Blocked ${target.username}`);
    }

    case 'unignore': {
      if (!isAdmin(message)) return message.reply({ content: '❌ Only admins can use this.', ephemeral: true });
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Usage: `-unignore @user`');
      botData.blockedUsers = botData.blockedUsers.filter(id => id !== target.id);
      saveData();
      return message.reply(`✅ Unblocked ${target.username}`);
    }

    case 'disable': {
      if (!isAdmin(message)) return message.reply({ content: '❌ Only admins can use this.', ephemeral: true });
      if (!botData.disabledChannels.includes(message.channel.id)) {
        botData.disabledChannels.push(message.channel.id);
        saveData();
      }
      return message.reply('🚫 Commands disabled here');
    }

    case 'enable': {
      if (!isAdmin(message)) return message.reply({ content: '❌ Only admins can use this.', ephemeral: true });
      botData.disabledChannels = botData.disabledChannels.filter(id => id !== message.channel.id);
      saveData();
      return message.reply('✅ Commands enabled here');
    }

    case 'bully': {
      if (!isAdmin(message)) return message.reply({ content: '❌ Only admins can use this.', ephemeral: true });
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Usage: `-bully @user`');
      const roasts = [
        "You’re the reason they put instructions on shampoo bottles 🧴",
        "If brains were dynamite, you wouldn’t have enough to blow your nose 💣",
        "You bring everyone joy… when you leave 😂",
        "I’d agree with you but then we’d both be wrong 🤡",
        "You have something on your chin… no, third one down 🤨"
      ];
      for (const line of roasts.sort(() => 0.5 - Math.random()).slice(0, 5)) {
        await message.channel.send(`${target} ${line}`).catch(() => {});
        await delay(700);
      }
      return;
    }

    case 'dw': {
      const opponent = message.mentions.users.first();
      if (!opponent) return message.reply('❌ `-dw @user [rounds] [max]`');
      const rounds = Math.max(1, Math.min(10, parseInt(args[1]) || 5));
      const max = parseInt(args[2]) || 1000;
      let your = 0, theirs = 0;
      await message.reply(`🎲 Dice War: ${message.author} vs ${opponent}`);
      for (let i = 1; i <= rounds; i++) {
        const r1 = Math.floor(Math.random() * max) + 1;
        const r2 = Math.floor(Math.random() * max) + 1;
        if (r1 > r2) your++;
        else if (r2 > r1) theirs++;
        await message.channel.send(`Round ${i}: ${r1} vs ${r2}`);
        await delay(900);
      }
      const result = your > theirs ? `${message.author} wins!` : theirs > your ? `${opponent} wins!` : 'Draw!';
      return message.channel.send(`🏆 Final: ${your}-${theirs} | ${result}`);
    }

    case 'cw': {
      const opponent = message.mentions.users.first();
      const pick = args.find(a => ['heads', 'tails'].includes(a.toLowerCase()));
      if (!opponent || !pick) return message.reply('❌ `-cw @user heads/tails`');
      let your = 0, theirs = 0;
      await message.reply(`🪙 Coin War: ${message.author} vs ${opponent} | Pick: ${pick.toUpperCase()}`);
      while (your < 2 && theirs < 2) {
        const flip = Math.random() < 0.5 ? 'heads' : 'tails';
        flip === pick ? your++ : theirs++;
        await message.channel.send(`Flip: ${flip.toUpperCase()} | ${your}-${theirs}`);
        await delay(900);
      }
      return message.channel.send(`🏆 Winner: ${your === 2 ? message.author : opponent}`);
    }

    case 'ship': {
      const u1 = message.mentions.users.at(0), u2 = message.mentions.users.at(1) || message.author;
      if (!u1) return message.reply('❌ `-ship @user1 [@user2]`');
      const percent = Math.floor(Math.random() * 101);
      const color = percent > 70 ? '#e91e63' : percent > 40 ? '#f39c12' : '#3498db';
      return message.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('💞 Match').setDescription(`${u1} × ${u2} = **${percent}%**`)] });
    }

    case 'choose': {
      if (!args.length) return message.reply('❌ `-choose opt1 opt2 ...`');
      return message.reply(`🎯 Picked: **${args[Math.floor(Math.random() * args.length)]}**`);
    }

    // --------------------------
    // ✅ GIVEAWAY + REROLL — FULLY WORKING
    // --------------------------
    case 'gw': case 'giveaway': {
      if (!isAdmin(message)) return message.reply('❌ Only admins can use this.');
      if (args.length < 4) {
        return message.reply('❌ **Usage:** `-gw <prize> <time> <requirements> <host>`\nExample: `-gw 100 Coins 2m Must be active @luckyyy`\nTime: s = seconds, m = minutes, h = hours, d = days');
      }

      const prize = args[0];
      const timeInput = args[1];
      const requirements = args.slice(2, -1).join(' ');
      const host = args.at(-1);
      const duration = parseTime(timeInput);

      if (!duration) return message.reply('❌ Invalid time format. Use: `10s`, `5m`, `1h`, `1d`');

      const endTimestamp = Math.floor((Date.now() + duration) / 1000);

      const giveawayEmbed = new EmbedBuilder()
        .setColor('#FF9900')
        .setTitle('🎉 NEW GIVEAWAY')
        .setDescription('React with ✅ below to enter!')
        .addFields(
          { name: '🏆 Prize', value: prize, inline: false },
          { name: '⏱️ Duration', value: timeInput, inline: true },
          { name: '📋 Requirements', value: requirements, inline: true },
          { name: '👤 Hosted by', value: host, inline: true },
          { name: '📅 Ends', value: `<t:${endTimestamp}:R>`, inline: false }
        )
        .setTimestamp(Date.now() + duration);

      const giveawayMessage = await message.channel.send({ embeds: [giveawayEmbed] });
      await giveawayMessage.react('✅');
      message.reply('✅ Giveaway started successfully!');

      setTimeout(async () => {
        try {
          const fetched = await giveawayMessage.fetch();
          const reaction = fetched.reactions.cache.get('✅');
          if (!reaction) return fetched.reply('❌ No entries found.');

          const users = await reaction.users.fetch();
          const entries = users.filter(u => !u.bot);

          if (!entries.size) return fetched.reply('❌ No one entered this giveaway.');

          const winner = entries.random();
          fetched.reply(`🎊 **GIVEAWAY ENDED!** 🎊\n🏆 Prize: **${prize}**\n👑 Winner: ${winner}\n📩 Contact ${host} to claim your reward!`);
        } catch (err) {
          console.error('Giveaway error:', err);
        }
      }, duration);

      return;
    }

    case 'reroll': {
      if (!isAdmin(message)) return message.reply('❌ Only admins can use this.');
      const messageId = args[0];
      if (!messageId) return message.reply('❌ **Usage:** `-reroll <giveaway_message_id>`');

      try {
        const targetMsg = await message.channel.messages.fetch(messageId);
        const reaction = targetMsg.reactions.cache.get('✅');
        if (!reaction) return message.reply('❌ No entries found on that message.');

        const users = await reaction.users.fetch();
        const entries = users.filter(u => !u.bot);

        if (!entries.size) return message.reply('❌ No valid participants.');

        const newWinner = entries.random();
        return targetMsg.reply(`🔄 **Giveaway Rerolled!**\n🏆 New Winner: ${newWinner}`);
      } catch {
        return message.reply('❌ Could not find that message — check the ID.');
      }
    }

    case 'help': {
      const helpEmbed = new EmbedBuilder()
        .setColor('#6A5ACD')
        .setTitle('✨ LUCKY’S COMMANDS')
        .addFields(
          { name: '🎮 FUN', value: '`-d` `-cf` `-choose` `-ship` `-dw` `-cw`' },
          { name: '💰 REWARDS', value: '`-balance` `-earningslb`' },
          { name: '🎉 GIVEAWAYS', value: '`-gw` `-giveaway` `-reroll`' },
          { name: '🛡️ ADMIN', value: '`-silence` `-ignore` `-unignore` `-disable` `-enable` `-bully`' }
        );
      return message.reply({ embeds: [helpEmbed] });
    }

    default:
      return message.reply('❌ Unknown command. Type `-help` to see available commands!');
  }
});

client.login(token).catch(err => console.error('❌ Login failed:', err.message));
