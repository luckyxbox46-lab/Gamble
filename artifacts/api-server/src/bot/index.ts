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
const CD = 15000; // ✅ CHANGED: 15 seconds cooldown
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

// 🚀 PERMANENT STORAGE
const DATA_DIR = '/persist';
const DATA_FILE = path.join(DATA_DIR, 'bot-data.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const defaultData = {
  disabledChannels: [],
  silenceMode: {},
  rewardsEnabled: {},
  blockedUsers: [],
  balances: {},
  rewardCfg: { t: 10000, a: 2 }
};

let botData;

if (fs.existsSync(DATA_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (saved.ignoredUsers && !saved.blockedUsers) {
      saved.blockedUsers = saved.ignoredUsers;
      delete saved.ignoredUsers;
    }
    botData = { ...defaultData, ...saved };
    console.log('✅ Loaded saved data');
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
  console.log('💾 Saved');
};

// --------------------------
// PERMISSION CHECKS
// --------------------------
const isOwner = m => m.author.username === OWNER_USERNAME;
const isServerOwner = m => m.guild && m.guild.ownerId === m.author.id;
const isAdmin = m => m.member?.permissions?.has(PermissionsBitField.Flags.Administrator);
const isCommandBlocked = userId => botData.blockedUsers.includes(userId);

function isSpam(content) {
  if (!content) return true;
  const clean = content.replace(/[\s!?.,~*_+=<>:"'|\\/[\]{}()@#$%^&-]/g, '');
  if (clean.length < MIN_MESSAGE_LENGTH) return true;
  if (/^(.)\1+$/.test(clean)) return true;
  return false;
}

// --------------------------
// GIVEAWAY HELPER
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

client.once('ready', () => console.log(`✅ Bot online: ${client.user.tag}`));

// --------------------------
// MESSAGE HANDLER
// --------------------------
client.on('messageCreate', async m => {
  if (!m.guild || m.author.bot) return;
  const g = m.guild.id;
  const u = m.author.id;
  const content = m.content.trim();

  if (botData.rewardsEnabled[g] === undefined) {
    botData.rewardsEnabled[g] = true;
    saveData();
  }

  // Count messages & rewards for EVERYONE, even blocked users
  if (botData.rewardsEnabled[g] === true) {
    const now = Date.now();
    if (
      !content.startsWith(PREFIX) &&
      !isSpam(content) &&
      now - (lastMsgTime.get(u) || 0) > MIN_TIME_BETWEEN &&
      content !== (lastMsg.get(u) || '')
    ) {
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
  }

  // Block commands only
  if (content.startsWith(PREFIX)) {
    if (isCommandBlocked(u)) {
      return m.reply({ content: '🚫 You are blocked from using bot commands.', ephemeral: true }).catch(() => {});
    }
    if (botData.silenceMode[g] && !isOwner(m) && !isServerOwner(m)) return;
    if (botData.disabledChannels.includes(m.channel.id) && !isAdmin(m)) return;
  } else {
    return;
  }

  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  if (!['d','cf','choose','help'].includes(cmd) && !isOwner(m)) {
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
      return m.reply(`🎲 Roll: **${roll}**`);
    }

    case 'cf': {
      const res = Math.random() < 0.5 ? 'Heads' : 'Tails';
      return m.reply(`🪙 Flip: **${res}**`);
    }

    case 'rewardtoggle': {
      if (!isOwner(m)) return m.reply({ content: '❌ Only the bot owner can use this.', ephemeral: true });
      botData.rewardsEnabled[g] = !botData.rewardsEnabled[g];
      saveData();
      return m.reply(botData.rewardsEnabled[g] ? '✅ Rewards **ENABLED**' : '❌ Rewards **DISABLED**');
    }

    case 'setreward': {
      if (!isOwner(m)) return m.reply({ content: '❌ Only the bot owner can use this.', ephemeral: true });
      const t = parseInt(args[0]), a = parseFloat(args[1]);
      if (!t || !a || t < 1) return m.reply('❌ Usage: `-setreward <messages> <amount>`');
      REWARD_THRESH = t; REWARD_AMT = a; saveData();
      return m.reply(`✅ Updated: **${formatNum(t)} messages = $${a.toFixed(2)}**`);
    }

    case 'balance': {
      const target = m.mentions.users.first() || m.author;
      if (m.mentions.users.first() && !isAdmin(m)) return m.reply({ content: '❌ Only admins can check others\' balance.', ephemeral: true });
      const data = botData.balances[target.id] || { count: 0, earned: 0 };
      const next = (Math.floor(data.count / REWARD_THRESH) + 1) * REWARD_THRESH;

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`💰 Balance — ${target.username}`)
        .addFields(
          { name: 'Total Messages', value: formatNum(data.count), inline: true },
          { name: 'Total Earned', value: `$${data.earned.toFixed(2)}`, inline: true },
          { name: 'Next Reward At', value: formatNum(next), inline: true }
        )
        .setTimestamp();
      return m.reply({ embeds: [embed] });
    }

    case 'earningslb': {
      const g = m.guild.id;
      if (botData.rewardsEnabled[g] !== true) return m.reply('❌ Rewards are currently disabled.');
      const sorted = Object.entries(botData.balances)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 10);
      if (!sorted.length) return m.reply('📊 No activity data yet.');

      let desc = '';
      for (let i = 0; i < sorted.length; i++) {
        const userId = sorted[i][0];
        const userData = sorted[i][1];
        try {
          const user = await client.users.fetch(userId);
          desc += `**${i+1}.** ${user.username} • ${formatNum(userData.count)} msgs • $${userData.earned.toFixed(2)}\n`;
        } catch {
          desc += `**${i+1}.** Unknown User (${userId}) • ${formatNum(userData.count)} msgs • $${userData.earned.toFixed(2)}\n`;
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle('🏆 Leaderboard — Most Messages')
        .setDescription(desc)
        .setTimestamp();
      return m.reply({ embeds: [embed] });
    }

    case 'savedata': {
      if (!isOwner(m)) return m.reply({ content: '❌ Only the bot owner can use this.', ephemeral: true });
      saveData();
      return m.reply({ content: '✅ All data saved successfully.', ephemeral: true });
    }

    case 'exportdata': {
      if (!isOwner(m)) return m.reply({ content: '❌ Only the bot owner can use this.', ephemeral: true });
      try {
        const backupFile = new AttachmentBuilder(DATA_FILE, { name: `bot-backup-${Date.now()}.json` });
        await m.author.send({ content: '📤 Here is your full backup:', files: [backupFile] });
        return m.reply({ content: '✅ Backup sent to your DMs as a file.', ephemeral: true });
      } catch (err) {
        return m.reply({ content: `❌ Failed to send backup: ${err.message}`, ephemeral: true });
      }
    }

    // ✅ FIXED IMPORT: REPLACES BALANCES COMPLETELY
    case 'importdata': {
      if (!isOwner(m)) return m.reply({ content: '❌ Only the bot owner can use this.', ephemeral: true });
      const json = args.join(' ');
      if (!json) return m.reply({ content: '❌ Usage: `-importdata <json>`', ephemeral: true });
      try {
        const imported = JSON.parse(json);
        botData = {
          ...defaultData,
          ...imported,
          balances: imported.balances || {},
          rewardCfg: { ...defaultData.rewardCfg, ...imported.rewardCfg }
        };
        REWARD_THRESH = botData.rewardCfg.t || 10000;
        REWARD_AMT = botData.rewardCfg.a || 2;
        saveData();
        return m.reply({ content: '✅ Data imported successfully — old balances cleared!', ephemeral: true });
      } catch (err) {
        return m.reply({ content: `❌ Invalid JSON: ${err.message}`, ephemeral: true });
      }
    }

    case 'importfile': {
      if (!isOwner(m)) return m.reply({ content: '❌ Only the bot owner can use this.', ephemeral: true });
      const attachment = m.attachments.first() || (m.reference?.messageId && (await m.channel.messages.fetch(m.reference.messageId)).attachments.first());
      if (!attachment || !attachment.name.endsWith('.json')) {
        return m.reply({ content: '❌ Please attach or reply to a valid `.json` backup file.', ephemeral: true });
      }
      try {
        const res = await fetch(attachment.url);
        const imported = await res.json();
        botData = {
          ...defaultData,
          ...imported,
          balances: imported.balances || {},
          rewardCfg: { ...defaultData.rewardCfg, ...imported.rewardCfg }
        };
        REWARD_THRESH = botData.rewardCfg.t || 10000;
        REWARD_AMT = botData.rewardCfg.a || 2;
        saveData();
        return m.reply({ content: '✅ File imported successfully — old balances cleared!', ephemeral: false });
      } catch (err) {
        return m.reply({ content: `❌ Failed to import file: ${err.message}`, ephemeral: true });
      }
    }

    case 'silence': {
      if (!isOwner(m) && !isServerOwner(m)) return m.reply({ content: '❌ Only bot owner or server owner can use this.', ephemeral: true });
      botData.silenceMode[g] = !botData.silenceMode[g];
      saveData();
      return m.reply(botData.silenceMode[g] ? '🔇 Commands muted (rewards still work)' : '🔊 Commands enabled');
    }

    case 'ignore': {
      if (!isAdmin(m)) return m.reply({ content: '❌ Only administrators can use this.', ephemeral: true });
      const target = m.mentions.users.first();
      if (!target) return m.reply('❌ Usage: `-ignore @user`');
      if (isOwner({author: target})) return m.reply('❌ Cannot ignore the bot owner.');
      if (!botData.blockedUsers.includes(target.id)) {
        botData.blockedUsers.push(target.id);
        saveData();
        return m.reply(`✅ **${target.username}** is blocked from using commands.`);
      }
      return m.reply(`ℹ️ **${target.username}** is already blocked.`);
    }

    case 'unignore': {
      if (!isAdmin(m)) return m.reply({ content: '❌ Only administrators can use this.', ephemeral: true });
      const target = m.mentions.users.first();
      if (!target) return m.reply('❌ Usage: `-unignore @user`');
      botData.blockedUsers = botData.blockedUsers.filter(id => id !== target.id);
      saveData();
      return m.reply(`✅ **${target.username}** can use commands again.`);
    }

    case 'disable': {
      if (!isAdmin(m)) return m.reply({ content: '❌ Only administrators can use this.', ephemeral: true });
      if (!botData.disabledChannels.includes(m.channel.id)) {
        botData.disabledChannels.push(m.channel.id);
        saveData();
      }
      return m.reply('🚫 Commands disabled in this channel');
    }

    case 'enable': {
      if (!isAdmin(m)) return m.reply({ content: '❌ Only administrators can use this.', ephemeral: true });
      botData.disabledChannels = botData.disabledChannels.filter(ch => ch !== m.channel.id);
      saveData();
      return m.reply('✅ Commands enabled in this channel');
    }

    case 'bully': {
      if (!isAdmin(m)) return m.reply({ content: '❌ Only administrators can use this.', ephemeral: true });
      const target = m.mentions.users.first();
      if (!target) return m.reply('❌ Usage: `-bully @user`');

      const insults = [
        "You’re the reason they put instructions on shampoo bottles 🧴",
        "If brains were dynamite, you wouldn’t have enough to blow your nose 💣",
        "You bring everyone so much joy… when you leave the room 😂",
        "I’d agree with you but then we’d both be wrong 🤡",
        "You have something on your chin… no, the third one down 🤨",
        "You’re not stupid, you just have bad luck thinking 🧠❌",
        "If you were any slower, you’d be going backward 🐢",
        "I thought of you today… it reminded me to take the trash out 🗑️",
        "You’re proof that evolution can go in reverse 🦍",
        "I’d explain it to you but I can’t understand it for you 🤷‍♂️",
        "You’re like a software update — everyone dreads you 📉",
        "If you spoke your mind, you’d be speechless 🤐",
        "You have an entire life to be annoying, why rush it?",
        "Somewhere out there is a tree working hard to produce oxygen for you… it’s a shame you waste it 🌳💨",
        "You’re the human equivalent of a participation award 🏅😴",
        "I’d roast you but my mom told me I’m not allowed to burn trash 🔥🗑️",
        "Your secrets are always safe with me… I never even listen when you talk 🎧🚫",
        "You’re not the dumbest person alive, but you better hope they don’t die 🤞",
        "If you were any more in the dark, you’d be a lightbulb 💡❌",
        "You’re the reason they lower the standards 📉",
        "It’s impossible to underestimate you 📏",
        "You have your entire life to act this way, why not take today off?",
        "You’re like a cloud — when you disappear, it’s a beautiful day ☁️☀️",
        "I’ve heard of being in the dark, but you’re in a whole different universe 🌑",
        "If there was a contest for ignorance, you’d come in first… and last 🥇😵",
        "You’re not useless, you can always serve as a bad example 📚❌",
        "I’d call you a tool, but even tools have a purpose 🔧🤷‍♀️",
        "You’re the reason they put warning labels on everything ⚠️",
        "Your brain is like a sieve — everything goes in and nothing stays 🧠🚰",
        "You have a face only a mother could love… and she probably regrets it 😬",
        "You’re like a broken pencil — pointless ✏️❌",
        "You’re the reason they invented the phrase ‘lower your expectations’ 📉",
        "If you were any more clueless, you’d be a door 🚪🤷‍♂️",
        "You bring a whole new meaning to the word ‘mediocre’ 📊",
        "I’d explain it to you but I left my English-to-Dumb dictionary at home 📖❌",
        "You’re like a smartphone with no signal — completely useless 📶🚫",
        "If common sense was common, you’d have some 🧠💭",
        "You’re not just a headache, you’re the whole migraine 🤕",
        "You have the personality of wet cardboard 📦💧",
        "If you were any more empty, you’d be a vacuum cleaner 🧹",
        "You’re proof that nature sometimes makes mistakes 🌍❌",
        "I’d make a joke about you, but the beatings aren’t funny enough 🤡",
        "If you were a movie, you’d be called ‘The Big Mistake’ 🎬❌",
        "You have the charm of a wet sock 🧦💦",
        "You’re like a zero — you add nothing and mean nothing 🔢",
        "If you were any less intelligent, you’d be a rock 🪨",
        "You’re not just wrong, you’re impressively wrong 🤯",
        "You bring new meaning to the word ‘failure’ 📉",
        "I’ve met rocks with more personality 🪨🤷‍♂️",
        "If you were a song, you’d be just noise 🎵🔇",
        "You’re like a broken clock — even when you’re right, it’s by accident ⏰❌",
        "You have the wit of a doorknob 🚪🤡",
        "If you were any more lost, you’d be in another galaxy 🌌",
        "You’re the reason people talk about ‘selective breeding’ 🧬❌",
        "You’re not dumb, you’re just on energy-saving mode 🔋💤",
        "If you were a plant, you’d be a weed 🌱🚫",
        "You have the charisma of a damp towel 🧺💧",
        "You’re like a computer with no operating system — completely useless 💻❌",
        "If you were any more annoying, you’d be a mosquito 🦟",
        "You’re the reason they test products before selling them 🧪❌",
        "You bring joy to everyone… when you leave 🚪😊",
        "If you were a shape, you’d be a useless blob 🟡🤷‍♀️",
        "You have the thinking speed of a snail 🐌💭",
        "You’re like static on a radio — just noise 📻🔊",
        "If you were a book, you’d be blank pages 📖❌",
        "You’re not just slow, you’re moving in reverse 🚗↩️",
        "You have the logic of a toddler 🧸🤦‍♂️",
        "If you were any more confused, you’d be a maze 🧩",
        "You’re like a candle with no flame — no light, no purpose 🕯️❌",
        "You’re the reason they say ‘don’t judge a book by its cover’ — because inside is empty 📕",
        "If you were a tool, you’d be the one left in the rain 🔧🌧️",
        "You have the attention span of a goldfish 🐠⏱️",
        "You’re like a bridge to nowhere — completely pointless 🌉❌",
        "If you were any more simple, you’d be a square 🟦",
        "You bring nothing to the conversation but silence 🤐💬",
        "You’re the reason they put ‘use with caution’ on everything ⚠️",
        "If you were a number, you’d be zero — worthless 0️⃣",
        "You have the creativity of a brick 🧱🎨",
        "You’re like a road with no exit — just going nowhere 🛣️❌",
        "If you were any more forgetful, you’d forget your own name 🧠🤷‍♂️",
        "You’re not just boring, you’re a cure for insomnia 😴",
        "You have the grace of a newborn giraffe 🦒🤸‍♂️",
        "If you were a season, you’d be winter — cold and lifeless ❄️",
        "You’re like a phone with no battery — completely dead 📱🔋❌",
        "You bring a new low to every room you enter 📉",
        "If you were any more dull, you’d be a pencil eraser ✏️🧽",
        "You have the courage of a house cat 🐱🙈",
        "You’re like a mirror that shows nothing — empty 🪞❌",
        "If you were a meal, you’d be plain bread — no taste, no value 🍞",
        "You’re the reason they say ‘some people just shouldn’t talk’ 🤐",
        "You have the coordination of a newborn fawn 🦌🤸‍♀️",
        "If you were any more quiet, you’d be invisible 👻",
        "You’re like a map with no directions — useless 🗺️❌",
        "You bring nothing but confusion and chaos 🤯",
        "If you were any more ordinary, you’d be invisible 👤"
      ];

      const shuffled = [...insults].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 8);

      for (const line of selected) {
        await m.channel.send(`${target} ${line}`).catch(() => {});
        await delay(700);
      }
      return;
    }

    case 'dw': {
      const opponent = m.mentions.users.first();
      if (!opponent) return m.reply('❌ Usage: `-dw @user [rounds] [max]` | Example: `-dw @eva 10 100000`');

      const numbersOnly = args.filter(arg => /^\d+$/.test(arg));
      const rounds = Math.max(1, Math.min(10, parseInt(numbersOnly[0]) || 5));
      const sides = Math.max(2, parseInt(numbersOnly[1]) || 1000);

      let yourScore = 0;
      let oppScore = 0;

      await m.reply(`🎲 **Dice War**: ${m.author.username} vs ${opponent.username}\n• Rounds: ${rounds}\n• Max value: ${sides.toLocaleString()}`);

      for (let i = 1; i <= rounds; i++) {
        const yourRoll = Math.floor(Math.random() * sides) + 1;
        const oppRoll = Math.floor(Math.random() * sides) + 1;

        if (yourRoll > oppRoll) yourScore++;
        else if (oppRoll > yourRoll) oppScore++;

        await m.channel.send(`Round ${i}: 🎲 **${yourRoll.toLocaleString()}** vs **${oppRoll.toLocaleString()}**`).catch(()=>{});
        await delay(900);
      }

      const result = yourScore > oppScore
        ? `🏆 Final Score: **${yourScore} - ${oppScore}** | ✅ **${m.author.username}** wins!`
        : oppScore > yourScore
          ? `🏆 Final Score: **${yourScore} - ${oppScore}** | ✅ **${opponent.username}** wins!`
          : `🏆 Final Score: **${yourScore} - ${oppScore}** | ⚖️ It's a draw!`;

      return m.channel.send(result);
    }

    case 'cw': {
      const opponent = m.mentions.users.first();
      const userPick = args.find(arg => ['heads','tails'].includes(arg.toLowerCase()))?.toLowerCase();

      if (!opponent || !userPick) {
        return m.reply('❌ Usage: `-cw @user heads/tails` | First to 2 points wins');
      }

      let yourScore = 0;
      let oppScore = 0;

      await m.reply(`🪙 **Coin War**: ${m.author.username} vs ${opponent.username}\nYou chose: **${userPick.toUpperCase()}**`);

      while (yourScore < 2 && oppScore < 2) {
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        if (result === userPick) yourScore++;
        else oppScore++;

        await m.channel.send(`Flip: **${result.toUpperCase()}** | Score: **${yourScore} - ${oppScore}**`).catch(()=>{});
        await delay(900);
      }

      const final = yourScore === 2
        ? `🏆 **${m.author.username}** wins! Final: ${yourScore} - ${oppScore}`
        : `🏆 **${opponent.username}** wins! Final: ${yourScore} - ${oppScore}`;

      return m.channel.send(final);
    }

    case 'ship': {
      const u1 = m.mentions.users.at(0), u2 = m.mentions.users.at(1) || m.author;
      if (!u1) return m.reply('❌ Usage: `-ship @user1 [@user2]`');
      const percent = Math.floor(Math.random() * 101);
      const color = percent > 70 ? '#e91e63' : percent > 40 ? '#f39c12' : '#3498db';
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('💞 Compatibility Check')
        .setDescription(`**${u1.username}** × **${u2.username}**\nMatch: **${percent}%**`);
      return m.reply({ embeds: [embed] });
    }

    case 'choose': {
      if (!args.length) return m.reply('❌ Usage: `-choose option1 option2 ...`');
      return m.reply(`🎯 Picked: **${args[Math.floor(Math.random() * args.length)]}**`);
    }

    // --------------------------
    // ✅ NEW GIVEAWAY COMMANDS
    // --------------------------
    case 'gw': case 'giveaway': {
      if (!isAdmin(m)) return m.reply('❌ Only administrators can use this.');
      if (args.length < 4) {
        return m.reply('❌ Usage: `-gw <prize> <time> <requirements> <host>`\nExample: `-gw 100 Coins 5m Must be active @luckyyy`\nTime: s=sec, m=min, h=hour, d=day');
      }
      const prize = args[0];
      const timeStr = args[1];
      const requirements = args.slice(2, -1).join(' ');
      const host = args.at(-1);
      const duration = parseTime(timeStr);
      if (!duration) return m.reply('❌ Invalid time — use e.g. `30s`, `10m`, `2h`');
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
          if (!reactions) return fetched.reply('❌ No entries found.');
          const users = await reactions.users.fetch();
          const participants = users.filter(u => !u.bot);
          if (!participants.size) return fetched.reply('❌ No one entered.');
          const winner = participants.random();
          fetched.reply(`🎊 **GIVEAWAY ENDED!** 🎊\n🏆 Prize: **${prize}**\n👑 Winner: ${winner}\n📩 Contact ${host} to claim!`);
        } catch (err) {
          console.error('Giveaway error:', err);
        }
      }, duration);
      return;
    }

    case 'reroll': {
      if (!isAdmin(m)) return m.reply('❌ Only administrators can use this.');
      const messageId = args[0];
      if (!messageId) return m.reply('❌ Usage: `-reroll <giveaway_message_id>`');
      try {
        const msg = await m.channel.messages.fetch(messageId);
        const reactions = msg.reactions.cache.get('✅');
        if (!reactions) return m.reply('❌ No entries found.');
        const users = await reactions.users.fetch();
        const participants = users.filter(u => !u.bot);
        if (!participants.size) return m.reply('❌ No valid participants.');
        const newWinner = participants.random();
        return msg.reply(`🔄 **Giveaway Rerolled!**\n🏆 New winner: ${newWinner}`);
      } catch {
        return m.reply('❌ Could not find that message — check ID and permissions.');
      }
    }

    case 'help': {
      const embed = new EmbedBuilder()
        .setColor('#6A5ACD')
        .setTitle('✨ LUCKY’S COMMAND CENTER ✨')
        .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nAll commands you can use — have fun! 🎉\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        .addFields(
          {
            name: '🎮 • FUN & GAMES',
            value: `
\`-d [max]\` 🎲 → Roll the dice
\`-cf\` 🪙 → Flip a coin
\`-choose <...>\` 🎯 → Let me pick for you
\`-ship @user [@user2]\` 💘 → Check your match!
\`-dw @user [rounds] [max]\` ⚔️ → Dice War challenge
\`-cw @user heads/tails\` 🪙 → Coin War battle
`,
            inline: false
          },
          {
            name: '💰 • REWARDS & STATS',
            value: `
\`-balance [@user]\` → Check your messages & earnings
\`-earningslb\` → View the server leaderboard
`,
            inline: false
          },
          {
            name: '🎉 • GIVEAWAYS',
            value: `
\`-gw / -giveaway\` → Start a new giveaway
\`-reroll <messageID>\` → Pick a new winner
`,
            inline: false
          },
          {
            name: '🛡️ • ADMIN CONTROLS',
            value: `
\`-silence\` 🔇/🔊 → Mute or unmute all commands
\`-ignore @user\` 🚫 → Block user from using commands
\`-unignore @user\` ✅ → Unblock user
\`-disable\` ❌ → Turn off commands in this channel
\`-enable\` ✅ → Turn commands back on
\`-bully @user\` 👊 → Send some friendly chaos
`,
            inline: false
          }
        )
        .setFooter({ text: '💡 Use -luckyshelp for owner-only commands | Prefix: -' })
        .setTimestamp();
      return m.reply({ embeds: [embed] });
    }

    case 'luckyshelp': {
      if (!isOwner(m)) return m.reply({ content: '❌ Only .luckyyy_ can use this command.', ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🔒 OWNER CONTROL PANEL')
        .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nYour exclusive commands only 🛠️\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        .addFields(
          {
            name: '⚙️ • BOT MANAGEMENT',
            value: `
\`-rewardtoggle\` → Turn rewards ON/OFF
\`-setreward <msgs> <amount>\` → Change reward rate
\`-savedata\` → Save all data manually
\`-exportdata\` → Get backup file in DMs
\`-importdata <json>\` → Import data (overwrites old balances)
\`-importfile\` → Import backup file directly
`,
            inline: false
          }
        )
        .setFooter({ text: 'Only you have access to these' })
        .setTimestamp();
      return m.reply({ embeds: [embed] });
    }

    default:
      return m.reply(`❌ Unknown command. Type \`-help\` to see what I can do!`);
  }
});

client.login(token).catch(err => console.error('❌ Login failed:', err.message));
