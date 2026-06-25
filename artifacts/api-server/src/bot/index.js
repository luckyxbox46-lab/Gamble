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
let REWARD_THRESH = 10000;
let REWARD_AMT = 2;
const userCd = new Map(), lastMsg = new Map(), lastMsgTime = new Map();
const giveaways = new Map();
const delay = ms => new Promise(r => setTimeout(r, ms));

const formatNum = (n) => n >= 1e6 ? (n/1e6).toFixed(1).replace(/\.0$/,'')+'m' : n >= 1e3 ? (n/1e3).toFixed(1).replace(/\.0$/,'')+'k' : n.toString();

// Storage
const DATA_DIR = './persist';
const DATA_FILE = path.join(DATA_DIR, 'bot-data.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const defaultData = { disabledChannels: [], silenceMode: {}, rewardsEnabled: {}, blockedUsers: [], balances: {}, rewardCfg: { t: 10000, a: 2 } };
let botData = fs.existsSync(DATA_FILE) ? { ...defaultData, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) } : { ...defaultData };
REWARD_THRESH = botData.rewardCfg.t || 10000;
REWARD_AMT = botData.rewardCfg.a || 2;
const saveData = () => { botData.rewardCfg = { t: REWARD_THRESH, a: REWARD_AMT }; fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2)); };

// Giveaway helper
function parseTime(input) {
  const m = input.match(/^(\d+)\s*(s|m|h|d)/i);
  if (!m) return null;
  const num = parseInt(m[1]);
  switch(m[2].toLowerCase()) {
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
      if (earned > botData.balances[u].earned) { botData.balances[u].earned = earned; saveData(); }
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
    case 'setreward': if (!isOwner(m)) return; const t=parseInt(args[0]),a=parseFloat(args[1]); if(!t||!a)return m.reply('❌ `-setreward <msgs> <amount>`'); REWARD_THRESH=t;REWARD_AMT=a;saveData();return m.reply(`✅ ${formatNum(t)} msgs = $${a.toFixed(2)}`);
    case 'balance': const tg=m.mentions.users.first()||m.author;const d=botData.balances[tg.id]||{count:0,earned:0};return m.reply({embeds:[new EmbedBuilder().setColor('#2ecc71').setTitle(`💰 ${tg.username}`).addFields({name:'Messages',value:formatNum(d.count),inline:true},{name:'Earned',value:`$${d.earned.toFixed(2)}`,inline:true},{name:'Next',value:formatNum((Math.floor(d.count/REWARD_THRESH)+1)*REWARD_THRESH),inline:true})]});
    case 'earningslb': if(!botData.rewardsEnabled[g])return m.reply('❌ Rewards OFF');const sorted=Object.entries(botData.balances).sort(([,a],[,b])=>b.count-a.count).slice(0,10);let desc='';for(let i=0;i<sorted.length;i++){try{const u=await client.users.fetch(sorted[i][0]);desc+=`**${i+1}.** ${u.username} • ${formatNum(sorted[i][1].count)} • $${sorted[i][1].earned.toFixed(2)}\n`}catch{desc+=`**${i+1}.** Unknown • ${formatNum(sorted[i][1].count)} • $${sorted[i][1].earned.toFixed(2)}\n`}}return m.reply({embeds:[new EmbedBuilder().setColor('#f1c40f').setTitle('🏆 Leaderboard').setDescription(desc)]});
    case 'silence': if(!isOwner(m))return;botData.silenceMode[g]=!botData.silenceMode[g];saveData();return m.reply(botData.silenceMode[g]?'🔇 Commands muted':'🔊 Commands enabled');
    case 'ignore': if(!isAdmin(m))return;const ig=m.mentions.users.first();if(!ig)return m.reply('❌ `-ignore @user`');if(!botData.blockedUsers.includes(ig.id)){botData.blockedUsers.push(ig.id);saveData();return m.reply(`✅ Blocked ${ig.username}`)}return m.reply('ℹ️ Already blocked');
    case 'unignore': if(!isAdmin(m))return;const un=m.mentions.users.first();if(!un)return m.reply('❌ `-unignore @user`');botData.blockedUsers=botData.blockedUsers.filter(id=>id!==un.id);saveData();return m.reply(`✅ Unblocked ${un.username}`);
    case 'disable': if(!isAdmin(m))return;if(!botData.disabledChannels.includes(m.channel.id)){botData.disabledChannels.push(m.channel.id);saveData()}return m.reply('🚫 Commands OFF here');
    case 'enable': if(!isAdmin(m))return;botData.disabledChannels=botData.disabledChannels.filter(ch=>ch!==m.channel.id);saveData();return m.reply('✅ Commands ON here');
    case 'giveaway': if(!isAdmin(m))return m.reply('❌ Only admins.');const parts=args.join(' ').split(' | ').map(p=>p.trim());if(parts.length!==4)return m.reply('❌ Format: `-giveaway Prize | 24h | Rules | @Host`');const [prize,timeStr,reqs,host]=parts;const dur=parseTime(timeStr);if(!dur)return m.reply('❌ Use 1m/1h/1d');const end=Date.now()+dur;const emb=new EmbedBuilder().setColor('#FF9900').setTitle('🎉 GIVEAWAY').setDescription('React ✅ to enter').addFields({name:'Prize',value:prize},{name:'Time',value:timeStr,inline:true},{name:'Rules',value:reqs,inline:true},{name:'Host',value:host,inline:true},{name:'Ends',value:`<t:${Math.floor(end/1000)}:R>`});const msg=await m.channel.send({embeds:[emb]});await msg.react('✅');setTimeout(async()=>{try{const full=await m.channel.messages.fetch(msg.id);const users=(await full.reactions.cache.get('✅').users.fetch()).filter(u=>!u.bot);if(!users.size)return full.reply('❌ No entries');const winner=users.random();full.reply(`🎊 **Ended!**\nPrize: ${prize}\nWinner: ${winner}\nContact ${host}`)}catch{}},dur);return m.reply('✅ Giveaway started');
    case 'reroll': if(!isAdmin(m))return;const mid=args[0];if(!mid)return m.reply('❌ `-reroll <message-id>`');try{const g=await m.channel.messages.fetch(mid);const users=(await g.reactions.cache.get('✅').users.fetch()).filter(u=>!u.bot);if(!users.size)return m.reply('❌ No participants');g.reply(`🔄 New winner: ${users.random()}`)}catch{return m.reply('❌ Not found')}break;
    case 'help': return m.reply({embeds:[new EmbedBuilder().setColor('#6A5ACD').setTitle('✨ Commands').setDescription(`🎮 Fun: -d, -cf, -choose, -ship, -dw, -cw\n💰 Rewards: -balance, -earningslb\n🎁 Giveaways: -giveaway, -reroll\n🛡️ Admin: -silence, -ignore, -unignore, -disable, -enable\n🔒 Owner: -rewardtoggle, -setreward`)]});
    default: return m.reply('❌ Unknown command. Type `-help`');
  }
});

client.login(token).catch(err=>console.error('❌ Login:',err.message));
