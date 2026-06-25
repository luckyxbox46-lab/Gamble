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

// Settings
const PREFIX = '-';
const OWNER_USERNAME = '.luckyyy_';
const CD = 15000;
const MIN_MESSAGE_LENGTH = 3;
const MIN_TIME_BETWEEN = 2000;
let REWARD_THRESH = 1000;
let REWARD_AMT = 0.50;
const userCd = new Map(), lastMsg = new Map(), lastMsgTime = new Map();
const delay = ms => new Promise(r => setTimeout(r, ms));

const formatNum = (n) => n >= 1e6 ? (n/1e6).toFixed(1).replace(/\.0$/,'')+'m' : n >= 1e3 ? (n/1e3).toFixed(1).replace(/\.0$/,'')+'k' : n.toString();

// Storage
const DATA_DIR = './persist';
const DATA_FILE = path.resolve(DATA_DIR, 'bot-data.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const defaultData = {
  disabledChannels: [],
  silenceMode: {},
  rewardsEnabled: {},
  blockedUsers: [],
  balances: {},
  rewardCfg: { t: 1000, a: 0.50 }
};

let botData;
try {
  if (fs.existsSync(DATA_FILE)) {
    botData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    botData = { ...defaultData, ...botData };
  } else {
    botData = { ...defaultData };
  }
} catch {
  botData = { ...defaultData };
}

REWARD_THRESH = botData.rewardCfg.t || 1000;
REWARD_AMT = botData.rewardCfg.a || 0.50;

const saveData = () => {
  botData.rewardCfg = { t: REWARD_THRESH, a: REWARD_AMT };
  fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2), 'utf8');
};

// ✅ FIXED: Time parser accepts short codes only
function parseTime(input) {
  const match = input.match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

// Permissions
const isOwner = m => m.author.username === OWNER_USERNAME;
const isAdmin = m => m.member?.permissions?.has(PermissionsBitField.Flags.Administrator);
const isBlocked = id => botData.blockedUsers.includes(id);
const isSpam = txt => !txt || txt.replace(/[^a-zA-Z0-9]/g,'').length < MIN_MESSAGE_LENGTH || /^(.)\1+$/.test(txt.replace(/\s/g,''));

client.once('ready', () => console.log(`✅ Bot online: ${client.user.tag}`));

client.on('messageCreate', async m => {
  if (!m.guild || m.author.bot) return;
  const g = m.guild.id, u = m.author.id, content = m.content.trim();

  if (botData.rewardsEnabled[g] === undefined) { botData.rewardsEnabled[g] = true; saveData(); }

  if (!content.startsWith(PREFIX) && !isSpam(content)) {
    const now = Date.now();
    if (now - (lastMsgTime.get(u) || 0) > MIN_TIME_BETWEEN && content !== lastMsg.get(u)) {
      if (!botData.balances[u]) botData.balances[u] = { count: 0, earned: 0 };
      botData.balances[u].count++;
      lastMsg.set(u, content);
      lastMsgTime.set(u, now);
      const earned = Math.floor(botData.balances[u].count / REWARD_THRESH) * REWARD_AMT;
      if (earned !== botData.balances[u].earned) {
        botData.balances[u].earned = earned;
        saveData();
      }
    }
  }

  if (!content.startsWith(PREFIX)) return;
  if (isBlocked(u)) return m.reply('🚫 Blocked from commands.').catch(()=>{});
  if (botData.silenceMode[g] && !isOwner(m)) return;
  if (botData.disabledChannels.includes(m.channel.id) && !isAdmin(m)) return;

  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  if (!['giveaway','reroll'].includes(cmd) && !isOwner(m)) {
    const last = userCd.get(u) || 0;
    if (Date.now() - last < CD) return m.reply(`⏳ Wait ${Math.ceil((CD - (Date.now()-last))/1000)}s`).catch(()=>{});
    userCd.set(u, Date.now());
  }

  switch(cmd) {
    case 'd': return m.reply(`🎲 Roll: **${Math.floor(Math.random() * (parseInt(args[0]) || 100)) + 1}**`);
    case 'cf': return m.reply(`🪙 Flip: **${Math.random()<0.5?'Heads':'Tails'}**`);
    case 'choose': return args.length ? m.reply(`🎯 Picked: **${args[Math.floor(Math.random()*args.length)]}**`) : m.reply('❌ Usage: `-choose opt1 opt2`');
    case 'rewardtoggle': if (!isOwner(m)) return; botData.rewardsEnabled[g] = !botData.rewardsEnabled[g]; saveData(); return m.reply(botData.rewardsEnabled[g]?'✅ Rewards ON':'❌ Rewards OFF');
    case 'setreward': if (!isOwner(m)) return; const t=parseInt(args[0]),a=parseFloat(args[1]); if(!t||!a||t<1)return m.reply('❌ `-setreward <messages> <amount>`'); REWARD_THRESH=t;REWARD_AMT=a;saveData();return m.reply(`✅ Updated: ${formatNum(t)} msgs = $${a.toFixed(2)}`);
    case 'balance': const tg=m.mentions.users.first()||m.author;const d=botData.balances[tg.id]||{count:0,earned:0};return m.reply({embeds:[new EmbedBuilder().setColor('#2ecc71').setTitle(`💰 ${tg.username}`).addFields({name:'Messages',value:formatNum(d.count),inline:true},{name:'Earned',value:`$${d.earned.toFixed(2)}`,inline:true},{name:'Next Reward',value:`${formatNum((Math.floor(d.count/REWARD_THRESH)+1)*REWARD_THRESH)} msgs`,inline:true})]});
    case 'earningslb': 
      if(!botData.rewardsEnabled[g])return m.reply('❌ Rewards are disabled.');
      const sorted = Object.entries(botData.balances).sort(([,a],[,b]) => b.count - a.count).slice(0,10);
      let desc = '';
      for(let i=0;i<sorted.length;i++){
        try{
          const user = await client.users.fetch(sorted[i][0]);
          desc += `**${i+1}.** ${user.username} • ${formatNum(sorted[i][1].count)} msgs • $${sorted[i][1].earned.toFixed(2)}\n`;
        }catch{
          desc += `**${i+1}.** Unknown • ${formatNum(sorted[i][1].count)} msgs • $${sorted[i][1].earned.toFixed(2)}\n`;
        }
      }
      return m.reply({embeds:[new EmbedBuilder().setColor('#f1c40f').setTitle('🏆 Leaderboard — Most Messages').setDescription(desc)]});
    case 'silence': if(!isOwner(m))return;botData.silenceMode[g]=!botData.silenceMode[g];saveData();return m.reply(botData.silenceMode[g]?'🔇 Commands muted':'🔊 Commands enabled');
    case 'ignore': if(!isAdmin(m))return;const ig=m.mentions.users.first();if(!ig)return m.reply('❌ `-ignore @user`');if(!botData.blockedUsers.includes(ig.id)){botData.blockedUsers.push(ig.id);saveData();return m.reply(`✅ Blocked ${ig.username}`)}return m.reply('ℹ️ Already blocked');
    case 'unignore': if(!isAdmin(m))return;const un=m.mentions.users.first();if(!un)return m.reply('❌ `-unignore @user`');botData.blockedUsers=botData.blockedUsers.filter(id=>id!==un.id);saveData();return m.reply(`✅ Unblocked ${un.username}`);
    case 'disable': if(!isAdmin(m))return;if(!botData.disabledChannels.includes(m.channel.id)){botData.disabledChannels.push(m.channel.id);saveData()}return m.reply('🚫 Commands OFF here');
    case 'enable': if(!isAdmin(m))return;botData.disabledChannels=botData.disabledChannels.filter(ch=>ch!==m.channel.id);saveData();return m.reply('✅ Commands ON here');
    case 'savedata': if(!isOwner(m))return; saveData(); return m.reply('✅ Data saved');
    case 'exportdata':
      if (!isOwner(m)) return m.reply('❌ Only owner can use this.');
      try {
        if (!fs.existsSync(DATA_FILE)) return m.reply('❌ No data file found.');
        const backup = new AttachmentBuilder(DATA_FILE, { name: `bot-backup-${Date.now()}.json` });
        await m.author.send({ content: '📤 Your backup:', files: [backup] });
        return m.reply('✅ Backup sent to DMs');
      } catch {
        return m.reply('❌ Failed — open your DMs first.');
      }

    // ✅ FULLY FIXED GIVEAWAY COMMAND
    case 'giveaway':
      if (!isAdmin(m)) return m.reply('❌ Only Administrators can start giveaways.');
      const rawInput = args.join(' ');
      const parts = rawInput.split(' | ').map(p => p.trim());
      if (parts.length !== 4) {
        return m.reply(`❌ **Wrong format!**
Use:
\`-giveaway <prize> | <time> | <requirements> | <host>\`
Example:
\`-giveaway 10$ | 1m | must be active | @luckyy\`
*Time options: s = seconds, m = minutes, h = hours, d = days*`);
      }
      const [prize, timeStr, requirements, host] = parts;
      const duration = parseTime(timeStr);
      if (!duration) {
        return m.reply('❌ Invalid time! Use format like: `1m`, `30m`, `2h`, `1d`');
      }
      const endTimestamp = Math.floor((Date.now() + duration) / 1000);
      const giveawayEmbed = new EmbedBuilder()
        .setColor('#FF9900')
        .setTitle('🎉 GIVEAWAY 🎉')
        .setDescription('React with ✅ below to enter!')
        .addFields(
          { name: '🏆 Prize', value: prize, inline: false },
          { name: '⏰ Duration', value: timeStr, inline: true },
          { name: '📋 Requirements', value: requirements, inline: true },
          { name: '👤 Hosted by', value: host, inline: true },
          { name: '📅 Ends', value: `<t:${endTimestamp}:R>`, inline: false }
        )
        .setTimestamp(Date.now() + duration);
      const giveawayMsg = await m.channel.send({ embeds: [giveawayEmbed] });
      await giveawayMsg.react('✅');
      m.reply('✅ Giveaway started successfully!');
      setTimeout(async () => {
        try {
          const fetchedMsg = await m.channel.messages.fetch(giveawayMsg.id);
          const reaction = fetchedMsg.reactions.cache.get('✅');
          if (!reaction) return fetchedMsg.reply(`❌ No entries found for **${prize}**`);
          const users = await reaction.users.fetch();
          const participants = users.filter(u => !u.bot);
          if (participants.size === 0) return fetchedMsg.reply(`❌ No one entered the giveaway!`);
          const winner = participants.random();
          fetchedMsg.reply(`🎊 **GIVEAWAY ENDED!** 🎊
🏆 **Prize:** ${prize}
👑 **Winner:** ${winner}
📩 Contact ${host} to claim your prize!`);
        } catch (err) {
          console.error('Giveaway error:', err);
        }
      }, duration);
      break;

    case 'reroll':
      if (!isAdmin(m)) return m.reply('❌ Only Administrators can reroll.');
      const messageId = args[0];
      if (!messageId) return m.reply('❌ Usage: `-reroll <giveaway_message_id>`');
      try {
        const msg = await m.channel.messages.fetch(messageId);
        const reaction = msg.reactions.cache.get('✅');
        if (!reaction) return m.reply('❌ No entries found on that message.');
        const users = await reaction.users.fetch();
        const participants = users.filter(u => !u.bot);
        if (participants.size === 0) return m.reply('❌ No participants to choose from.');
        const newWinner = participants.random();
        msg.reply(`🔄 **REROLL COMPLETE!** 🎉
New winner: ${newWinner}`);
      } catch {
        return m.reply('❌ Could not find that message — check the ID.');
      }
      break;

    case 'help':
      return m.reply({ embeds: [new EmbedBuilder().setColor('#6A5ACD').setTitle('✨ Bot Commands').setDescription(`
🎮 **Fun Commands**
\`-d <max>\` • Roll dice
\`-cf\` • Flip coin
\`-choose <opt1> <opt2> ...\` • Pick random option

💰 **Rewards System**
\`-balance\` • Check your balance
\`-earningslb\` • View leaderboard

🎁 **Giveaways**
\`-giveaway <prize> | <time> | <rules> | <host>\` • Start giveaway
\`-reroll <message_id>\` • Pick new winner

💾 **Data**
\`-savedata\` • Save data manually
\`-exportdata\` • Get backup file

🛡️ **Admin Only**
\`-silence\` • Mute/unmute commands
\`-ignore @user\` • Block user
\`-unignore @user\` • Unblock user
\`-disable\` • Disable commands in channel
\`-enable\` • Enable commands in channel

🔒 **Owner Only**
\`-rewardtoggle\` • Turn rewards on/off
\`-setreward <msgs> <amount>\` • Change reward rate
      `)]});
    default:
      return m.reply('❌ Unknown command. Type `-help` to see all commands.');
  }
});

client.login(token).catch(err=>console.error('❌ Login error:', err.message));
