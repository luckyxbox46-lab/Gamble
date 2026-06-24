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
let REWARD_THRESH = 10000;
let REWARD_AMT = 2;
const userCd = new Map(), lastMsg = new Map(), msgCd = new Map();
const delay = ms => new Promise(r => setTimeout(r, ms));

const formatNum = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'm';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toString();
};

// 🚀 PERMANENT STORAGE — NO RESETS
const DATA_DIR = '/persist';
const DATA_FILE = path.join(DATA_DIR, 'bot-data.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Default: REWARDS ENABLED by default now
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

// Load data — NEVER overwrite existing balances
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
    console.log('✅ Loaded saved data — balances preserved');
  } catch {
    console.log('⚠️ Data file corrupted — starting fresh');
    botData = { ...defaultData };
  }
} else {
  console.log('ℹ️ No data found — using defaults');
  botData = { ...defaultData };
}

REWARD_THRESH = botData.rewardCfg.t || 10000;
REWARD_AMT = botData.rewardCfg.a || 2;

const saveData = () => {
  botData.rewardCfg = { t: REWARD_THRESH, a: REWARD_AMT };
  fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2), 'utf8');
  console.log('💾 Saved to permanent storage');
};

// --------------------------
// PERMISSIONS
// --------------------------
const isOwner = m => m.author.username === OWNER;
const isAdmin = m => isOwner(m) || m.member?.permissions?.has(PermissionsBitField.Flags.Administrator);
const isIgnored = id => botData.ignoredUsers.includes(id);

client.once('clientReady', () => console.log(`✅ Bot online: ${client.user.tag}`));

// --------------------------
// MESSAGE HANDLER
// --------------------------
client.on('messageCreate', async m => {
  if (!m.guild || m.author.bot) return;
  const g = m.guild.id;
  const u = m.author.id;

  // Auto-enable rewards if not set
  if (botData.rewardsEnabled[g] === undefined) {
    botData.rewardsEnabled[g] = true;
    saveData();
  }

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
      return m.reply(`🎲 Roll: **${roll}**`);
    }
    case 'cf': {
      const res = Math.random() < 0.5 ? 'Heads' : 'Tails';
      botData.stats.flips++; saveData();
      return m.reply(`🪙 Flip: **${res}**`);
    }
    case 'rewardtoggle': {
      if (!isOwner(m)) return m.reply('❌ Only owner can use this command');
      botData.rewardsEnabled[g] = !botData.rewardsEnabled[g];
      saveData();
      return m.reply(botData.rewardsEnabled[g] ? '✅ Rewards **ENABLED** & saved' : '❌ Rewards **DISABLED** & saved');
    }
    case 'setreward': {
      if (!isOwner(m)) return m.reply('❌ Only owner can use this command');
      const t = parseInt(args[0]), a = parseFloat(args[1]);
      if (!t || !a || t < 1) return m.reply('❌ Usage: `-setreward <messages> <amount>`');
      REWARD_THRESH = t; REWARD_AMT = a; saveData();
      return m.reply(`✅ Updated: **${formatNum(t)} messages = $${a.toFixed(2)}**`);
    }
    case 'balance': {
      const target = m.mentions.users.first() || m.author;
      if (m.mentions.users.first() && !isAdmin(m)) return m.reply('❌ Only admins can check others\' balance');
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
      const sorted = Object.entries(botData.balances).sort(([,a], [,b]) => b.earned - a.earned).slice(0,10);
      if (!sorted.length) return m.reply('📊 No earnings data yet');

      let desc = '';
      for (let i = 0; i < sorted.length; i++) {
        const user = await client.users.fetch(sorted[i][0]).catch(() => null);
        desc += `**${i+1}.** ${user?.username || 'Unknown'} • ${formatNum(sorted[i][1].count)} msgs • $${sorted[i][1].earned.toFixed(2)}\n`;
      }

      const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle('🏆 Top Earners')
        .setDescription(desc)
        .setTimestamp();
      return m.reply({ embeds: [embed] });
    }
    case 'savedata': {
      if (!isOwner(m)) return m.reply('❌ This command is for the owner only');
      saveData();
      return m.reply('✅ Data saved — will **never reset** on deploy!');
    }
    case 'exportdata': {
      if (!isOwner(m)) return m.reply('❌ This command is for the owner only');
      try {
        await m.reply({
          content: '📤 Your full backup file:',
          files: [{ attachment: DATA_FILE, name: `bot-backup-${Date.now()}.json` }]
        });
      } catch { return m.reply('❌ Failed to send backup'); }
      return;
    }
    case 'importdata': {
      if (!isOwner(m)) return m.reply('❌ Owner only');
      return m.reply('📤 Send your old backup .json file as attachment and I will restore it');
    }
    case 'silence': {
      if (!isOwner(m)) return m.reply('❌ Only owner can use this');
      botData.silenceMode[g] = !botData.silenceMode[g];
      saveData();
      return m.reply(botData.silenceMode[g] ? '🔇 Commands muted — rewards still work' : '🔊 Commands enabled');
    }
    case 'ignore': {
      if (!isAdmin(m)) return m.reply('❌ Only admins can use this');
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
      if (!isAdmin(m)) return m.reply('❌ Only admins can use this');
      const target = m.mentions.users.first();
      if (!target) return m.reply('❌ Usage: `-unignore @user`');
      if (botData.ignoredUsers.includes(target.id)) {
        botData.ignoredUsers = botData.ignoredUsers.filter(id => id !== target.id);
        saveData();
        return m.reply(`✅ No longer ignoring **${target.username}**`);
      }
      return m.reply(`ℹ️ **${target.username}** is not ignored`);
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
      if (!isAdmin(m) || !m.mentions.users.first()) return m.reply('❌ Usage: `-bully @user`');
      const target = m.mentions.users.first();
      for (let i = 0; i < 8; i++) { await m.channel.send(`${target} 👊`).catch(()=>{}); await delay(600); }
      return;
    }
    case 'dw': {
      const argsParts = args.filter(a => !a.startsWith('<@'));
      const opp = m.mentions.users.first();
      const rounds = Math.max(1, Math.min(10, parseInt(argsParts[0]) || 5));
      const sides = Math.max(2, parseInt(argsParts[1]) || 1000);
      if (!opp) return m.reply('❌ Usage: `-dw @user [rounds] [sides]`');
      let yourScore = 0, oppScore = 0;
      await m.reply(`🎲 Dice War: **${m.author.username} vs ${opp.username}**\n${rounds} rounds • d${sides}`);
      for (let i = 1; i <= rounds; i++) {
        const y = Math.floor(Math.random() * sides) + 1;
        const o = Math.floor(Math.random() * sides) + 1;
        const res = y > o ? (yourScore++, '✅ You win round') : o > y ? (oppScore++, `❌ ${opp.username} wins round`) : '⚖️ Draw';
        await m.channel.send(`Round ${i}: 🎲 **${y}** vs 🎲 **${o}**\n${res}`).catch(()=>{});
        await delay(900);
      }
      const final = `🏆 Final Score: **You ${yourScore} - ${oppScore} ${opp.username}**\n${yourScore > oppScore ? '✅ You win the match!' : oppScore > yourScore ? `❌ ${opp.username} wins the match!` : '⚖️ Match ends in a draw!'}`;
      return m.channel.send(final);
    }
    case 'cw': {
      const opp = m.mentions.users.first(), side = args[1]?.toLowerCase();
      if (!opp || !['heads','tails'].includes(side)) return m.reply('❌ Usage: `-cw @user <heads/tails>`');
      let u = 0, o = 0;
      await m.reply(`🪙 Coin War: **${m.author.username} vs ${opp.username}**\nFirst to 2 wins`);
      while (u < 2 && o < 2) {
        const flip = Math.random() < 0.5 ? 'Heads' : 'Tails';
        flip === side ? u++ : o++;
        await m.channel.send(`Flip: **${flip}** | Score: **${u} - ${o}**`).catch(()=>{});
        await delay(900);
      }
      return m.channel.send(u === 2 ? `🏆 **${m.author.username}** wins!` : `🏆 **${opp.username}** wins!`);
    }
    case 'ship': {
      if (!m.mentions.users.size) return m.reply('❌ Usage: `-ship @user1 @user2`');
      const user1 = m.mentions.users.at(0);
      const user2 = m.mentions.users.at(1) || m.author;
      const percent = Math.floor(Math.random() * 101);
      const embed = new EmbedBuilder()
        .setColor(percent >= 70 ? '#e91e63' : percent >= 40 ? '#f39c12' : '#3498db')
        .setTitle('💞 Compatibility Check')
        .setDescription(`**${user1.username}** & **${user2.username}**\nMatch: **${percent}%**`)
        .setTimestamp();
      return m.reply({ embeds: [embed] });
    }
    case 'choose': {
      if (!args.length) return m.reply('❌ Usage: `-choose <option1> <option2> ...`');
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

    // ✅ PUBLIC HELP - EMBED
    case 'help': {
      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('📖 Public Commands')
        .setDescription('All commands available to everyone')
        .addFields(
          {
            name: '💰 Rewards',
            value: '`-balance [@user]` • Check your balance\n`-earningslb` • View top earners',
            inline: false
          },
          {
            name: '🎲 Games',
            value: '`-d [max]` • Roll dice\n`-cf` • Flip coin\n`-choose <opt...>` • Pick random\n`-ship @user` • Compatibility\n`-dw @user [r] [s]` • Dice War\n`-cw @user <side>` • Coin War\n`-stats` • Bot stats',
            inline: false
          },
          {
            name: '👑 Admin',
            value: '`-ignore @user` • Block commands\n`-unignore @user` • Unblock\n`-disable` • Disable here\n`-enable` • Enable here\n`-bully @user` • Spam ping',
            inline: false
          }
        )
        .setFooter({ text: 'Use -luckyshelp for full owner commands' })
        .setTimestamp();
      return m.reply({ embeds: [embed] });
    }

    // ✅ OWNER ONLY HELP - EMBED
    case 'luckyshelp': {
      if (!isOwner(m)) return m.reply('❌ This command is for the owner only');
      const embed = new EmbedBuilder()
        .setColor('#e67e22')
        .setTitle('🔒 Lucky\'s Full Command List')
        .setDescription('All commands including owner-only')
        .addFields(
          {
            name: '💰 Rewards & Data',
            value: '`-rewardtoggle` • Enable/disable rewards\n`-setreward <msgs> <amt>` • Set rate\n`-balance [@user]` • Check balance\n`-earningslb` • Leaderboard\n`-savedata` • Save all data\n`-exportdata` • Download backup\n`-importdata` • Restore backup',
            inline: false
          },
          {
            name: '🎲 Games',
            value: '`-d` `-cf` `-choose` `-ship` `-dw` `-cw` `-stats`',
            inline: false
          },
          {
            name: '👑 Admin',
            value: '`-ignore` `-unignore` `-disable` `-enable` `-bully`',
            inline: false
          },
          {
            name: '🔒 Owner Only',
            value: '`-silence` • Mute/unmute all commands',
            inline: false
          }
        )
        .setTimestamp();
      return m.reply({ embeds: [embed] });
    }
  }
});

client.login(token).catch(err => console.error('❌ Login failed:', err.message));
