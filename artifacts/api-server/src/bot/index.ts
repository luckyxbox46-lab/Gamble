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
    GatewayIntentBits.GuildMembers
  ]
});

// --------------------------
// SETTINGS
// --------------------------
const PREFIX = '-';
const OWNER = '.luckyyy_';
const CD = 20000;
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
  stats: { rolls: 0, flips: 0, started: Date.now() },
  disabledChannels: [],
  silenceMode: {},
  rewardsEnabled: {},
  ignoredUsers: [],
  balances: {},
  rewardCfg: { t: 10000, a: 2 }
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
const isOwner = m => m.author.username === OWNER;
const isAdmin = m => isOwner(m) || m.member?.permissions?.has(PermissionsBitField.Flags.Administrator);
const isIgnored = id => botData.ignoredUsers.includes(id);

function isSpam(content) {
  if (!content) return true;
  const clean = content.replace(/[\s!?.,~*_+=<>:"'|\\/[\]{}()@#$%^&-]/g, '');
  if (clean.length < MIN_MESSAGE_LENGTH) return true;
  if (/^(.)\1+$/.test(clean)) return true;
  return false;
}

client.once('clientReady', () => console.log(`✅ Bot online: ${client.user.tag}`));

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

  // Count only normal messages, not commands or spam
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

  if (!content.startsWith(PREFIX)) return;
  if (isIgnored(u)) return;
  if (botData.silenceMode[g] && !isOwner(m)) return;
  if (botData.disabledChannels.includes(m.channel.id) && !isAdmin(m)) return;

  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  if (!['d','cf','choose'].includes(cmd) && !isOwner(m)) {
    const last = userCd.get(u) || 0;
    if (Date.now() - last < CD) return m.reply(`⏳ Wait ${Math.ceil((CD - (Date.now() - last))/1000)}s`).catch(()=>{});
    userCd.set(u, Date.now());
  }

  // --------------------------
  // ALL ORIGINAL COMMANDS
  // --------------------------
  switch (cmd) {
    case 'd': {
      const max = parseInt(args[0]) || 100;
      const roll = Math.floor(Math.random() * max) + 1;
      botData.stats.rolls++; saveData();
      return m.reply(`🎲 Roll: **${roll}**`);
    }
    case 'cf': {
      const res = Math.random() < 0.5 ? 'Heads' : 'Tails';
      botData.stats.flips++; saveData();
      return m.reply(`🪙 Flip: **${res}**`);
    }
    case 'rewardtoggle': {
      if (!isOwner(m)) return m.reply({ content: '❌ Only owner can use this', ephemeral: true });
      botData.rewardsEnabled[g] = !botData.rewardsEnabled[g];
      saveData();
      return m.reply(botData.rewardsEnabled[g] ? '✅ Rewards **ENABLED** & saved' : '❌ Rewards **DISABLED** & saved');
    }
    case 'setreward': {
      if (!isOwner(m)) return m.reply({ content: '❌ Only owner can use this', ephemeral: true });
      const t = parseInt(args[0]), a = parseFloat(args[1]);
      if (!t || !a || t < 1) return m.reply('❌ Usage: `-setreward <messages> <amount>`');
      REWARD_THRESH = t; REWARD_AMT = a; saveData();
      return m.reply(`✅ Updated: **${formatNum(t)} messages = $${a.toFixed(2)}**`);
    }
    case 'balance': {
      const target = m.mentions.users.first() || m.author;
      if (m.mentions.users.first() && !isAdmin(m)) return m.reply({ content: '❌ Only admins can check others\' balance', ephemeral: true });
      const data = botData.balances[target.id] || { count: 0, earned: 0 };
      const next = (Math.floor(data.count / REWARD_THRESH) + 1) * REWARD_THRESH;

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`💰 Balance - ${target.username}`)
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
      if (botData.rewardsEnabled[g] !== true) return m.reply('❌ Rewards are disabled');
      // Sorted by most messages first
      const sorted = Object.entries(botData.balances)
        .sort(([, userA], [, userB]) => userB.count - userA.count)
        .slice(0, 10);

      if (!sorted.length) return m.reply('📊 No activity data yet');

      let desc = '';
      for (let i = 0; i < sorted.length; i++) {
        const user = await client.users.fetch(sorted[i][0]).catch(() => null);
        desc += `**${i+1}.** ${user?.username || 'Unknown User'} • ${formatNum(sorted[i][1].count)} msgs • $${sorted[i][1].earned.toFixed(2)}\n`;
      }

      const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle('🏆 Leaderboard (Most Messages)')
        .setDescription(desc)
        .setTimestamp();
      return m.reply({ embeds: [embed] });
    }
    case 'savedata': {
      if (!isOwner(m)) return m.reply({ content: '❌ Only owner can use this', ephemeral: true });
      saveData();
      return m.reply({ content: '✅ Data saved — will **never reset**!', ephemeral: true });
    }
    case 'exportdata': {
      if (!isOwner(m)) return m.reply({ content: '❌ Only owner can use this', ephemeral: true });
      try {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
        await m.author.send({ content: `📤 **PRIVATE BACKUP**\n\`\`\`json\n${fileContent}\n\`\`\`` });
        return m.reply({ content: '✅ Backup sent to DMs!', ephemeral: true });
      } catch {
        return m.reply({ content: `📤 **PRIVATE BACKUP**\n\`\`\`json\n${fs.readFileSync(DATA_FILE, 'utf8')}\n\`\`\``, ephemeral: true });
      }
    }
    case 'importdata': {
      if (!isOwner(m)) return m.reply({ content: '❌ Only owner can use this', ephemeral: true });
      const jsonInput = args.join(' ');
      if (!jsonInput) return m.reply({ content: '📥 Usage: `-importdata <your-json-data>`', ephemeral: true });
      try {
        const imported = JSON.parse(jsonInput);
        botData = {
          ...defaultData,
          ...imported,
          balances: { ...botData.balances, ...imported.balances },
          rewardCfg: { ...botData.rewardCfg, ...imported.rewardCfg }
        };
        REWARD_THRESH = botData.rewardCfg.t || 10000;
        REWARD_AMT = botData.rewardCfg.a || 2;
        saveData();
        return m.reply({ content: '✅ Import successful!', ephemeral: true });
      } catch (err) {
        return m.reply({ content: `❌ Invalid JSON: ${err.message}`, ephemeral: true });
      }
    }
    case 'silence': {
      if (!isOwner(m)) return m.reply({ content: '❌ Only owner can use this', ephemeral: true });
      botData.silenceMode[g] = !botData.silenceMode[g];
      saveData();
      return m.reply(botData.silenceMode[g] ? '🔇 Commands muted — rewards still work' : '🔊 Commands enabled');
    }
    case 'ignore': {
      if (!isAdmin(m)) return m.reply({ content: '❌ Only admins can use this', ephemeral: true });
      const target = m.mentions.users.first();
      if (!target) return m.reply('❌ Usage: `-ignore @user`');
      if (isOwner({author: target})) return m.reply('❌ Cannot ignore the owner');
      if (!botData.ignoredUsers.includes(target.id)) {
        botData.ignoredUsers.push(target.id);
        saveData();
        return m.reply(`✅ Now ignoring **${target.username}**`);
      }
      return m.reply(`ℹ️ Already ignoring **${target.username}**`);
    }
    case 'unignore': {
      if (!isAdmin(m)) return m.reply({ content: '❌ Only admins can use this', ephemeral: true });
      const target = m.mentions.users.first();
      if (!target) return m.reply('❌ Usage: `-unignore @user`');
      botData.ignoredUsers = botData.ignoredUsers.filter(id => id !== target.id);
      saveData();
      return m.reply(`✅ No longer ignoring **${target.username}**`);
    }
    case 'disable': {
      if (!isAdmin(m)) return m.reply({ content: '❌ Only admins can use this', ephemeral: true });
      if (!botData.disabledChannels.includes(m.channel.id)) {
        botData.disabledChannels.push(m.channel.id);
        saveData();
      }
      return m.reply('🚫 Commands disabled in this channel');
    }
    case 'enable': {
      if (!isAdmin(m)) return m.reply({ content: '❌ Only admins can use this', ephemeral: true });
      botData.disabledChannels = botData.disabledChannels.filter(ch => ch !== m.channel.id);
      saveData();
      return m.reply('✅ Commands enabled in this channel');
    }
    case 'bully': {
      if (!isAdmin(m) || !m.mentions.users.first()) return m.reply({ content: '❌ Usage: `-bully @user`', ephemeral: true });
      const target = m.mentions.users.first();
      for (let i = 0; i < 8; i++) { await m.channel.send(`${target} 👊`).catch(()=>{}); await delay(600); }
      return;
    }
    case 'dw': {
      const opp = m.mentions.users.first();
      const rounds = Math.max(1, Math.min(10, parseInt(args[0]) || 5));
      const sides = Math.max(2, parseInt(args[1]) || 1000);
      if (!opp) return m.reply('❌ Usage: `-dw @user [rounds] [max]`');
      let your = 0, opps = 0;
      await m.reply(`🎲 Dice War: **${m.author.username} vs ${opp.username}**`);
      for (let i = 1; i <= rounds; i++) {
        const y = Math.floor(Math.random() * sides) + 1;
        const o = Math.floor(Math.random() * sides) + 1;
        y > o ? your++ : o > y ? opps++ : null;
        await m.channel.send(`Round ${i}: 🎲 ${y} vs ${o}`).catch(()=>{});
        await delay(900);
      }
      return m.channel.send(`🏆 Final Score: **${your} - ${opps}** | ${your > opps ? '✅ You win!' : opps > your ? `✅ ${opp.username} wins!` : '⚖️ Draw!'}`);
    }
    case 'cw': {
      const opp = m.mentions.users.first(), side = args[1]?.toLowerCase();
      if (!opp || !['heads','tails'].includes(side)) return m.reply('❌ Usage: `-cw @user heads/tails`');
      let u = 0, o = 0;
      await m.reply(`🪙 Coin War: **${m.author.username} vs ${opp.username}**`);
      while (u < 2 && o < 2) {
        const flip = Math.random() < 0.5 ? 'Heads' : 'Tails';
        flip === side ? u++ : o++;
        await m.channel.send(`Flip: **${flip}** | Score: ${u} - ${o}`).catch(()=>{});
        await delay(900);
      }
      return m.channel.send(u === 2 ? `🏆 **${m.author.username}** wins!` : `🏆 **${opp.username}** wins!`);
    }
    case 'ship': {
      const u1 = m.mentions.users.at(0), u2 = m.mentions.users.at(1) || m.author;
      if (!u1) return m.reply('❌ Usage: `-ship @user1 [@user2]`');
      const p = Math.floor(Math.random() * 101);
      const embed = new EmbedBuilder()
        .setColor(p > 70 ? '#e91e63' : p > 40 ? '#f39c12' : '#3498db')
        .setTitle('💞 Compatibility')
        .setDescription(`**${u1.username}** × **${u2.username}**\nMatch: **${p}%**`);
      return m.reply({ embeds: [embed] });
    }
    case 'choose': {
      if (!args.length) return m.reply('❌ Usage: `-choose option1 option2 ...`');
      return m.reply(`🎯 Picked: **${args[Math.floor(Math.random() * args.length)]}**`);
    }
    case 'stats': {
      const uptime = Math.floor((Date.now() - botData.stats.started) / 60000);
      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('📊 Bot Statistics')
        .addFields(
          { name: '🎲 Total Rolls', value: botData.stats.rolls.toString(), inline: true },
          { name: '🪙 Total Flips', value: botData.stats.flips.toString(), inline: true },
          { name: '⏱️ Uptime', value: `${uptime} minutes`, inline: true }
        )
        .setTimestamp();
      return m.reply({ embeds: [embed] });
    }
    case 'help': {
      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('📖 Available Commands')
        .setDescription(`
**General:**
\`-d [max]\` — Roll dice
\`-cf\` — Flip a coin
\`-balance [@user]\` — Check message count & earnings
\`-earningslb\` — Leaderboard by most messages
\`-choose ...\` — Pick a random option
\`-ship @user1 [@user2]\` — Compatibility check
\`-dw @user [rounds] [max]\` — Dice war
\`-cw @user heads/tails\` — Coin war
\`-stats\` — View bot stats
\`-help\` — Show this menu
        `)
        .setTimestamp();
      return m.reply({ embeds: [embed] });
    }
    case 'luckyshelp': {
      if (!isOwner(m)) return m.reply({ content: '❌ This command is for the owner only', ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor('#e67e22')
        .setTitle('🔒 Owner Commands')
        .setDescription(`
**Owner Only:**
\`-rewardtoggle\` — Turn rewards on/off
\`-setreward <msgs> <amount>\` — Set reward rate
\`-savedata\` — Save data manually
\`-exportdata\` — Get backup JSON
\`-importdata <json>\` — Restore from backup
\`-silence\` — Mute/unmute all commands
\`-ignore @user\` — Block user from counting
\`-unignore @user\` — Unblock user
\`-disable\` — Disable commands in this channel
\`-enable\` — Enable commands in this channel
\`-bully @user\` — Send 8 pings
        `)
        .setTimestamp();
      return m.reply({ embeds: [embed] });
    }
    default:
      return m.reply(`❌ Unknown command. Use \`-help\` to see available commands.`);
  }
});

client.login(token).catch(err => console.error('❌ Login failed:', err.message));
