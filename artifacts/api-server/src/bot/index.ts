const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// ✅ Uses ONLY environment variable — NO TOKEN IN CODE
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) { console.error('❌ DISCORD_BOT_TOKEN missing!'); process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions // ✅ REQUIRED for giveaways
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

// 🚀 PERMANENT STORAGE
const DATA_DIR = '/persist';
const DATA_FILE = path.join(DATA_DIR, 'bot-data.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const defaultData = {
  disabledChannels: [], silenceMode: {}, rewardsEnabled: {}, blockedUsers: [], balances: {}, rewardCfg: { t: 10000, a: 2 }
};

let botData;
if (fs.existsSync(DATA_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    botData = { ...defaultData, ...saved };
    console.log('✅ Loaded saved data');
  } catch { botData = { ...defaultData }; }
} else { botData = { ...defaultData }; }

REWARD_THRESH = botData.rewardCfg.t || 10000;
REWARD_AMT = botData.rewardCfg.a || 2;
const saveData = () => { botData.rewardCfg = { t: REWARD_THRESH, a: REWARD_AMT }; fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2)); };

// --------------------------
// HELPERS
// --------------------------
const isOwner = m => m.author.username === OWNER_USERNAME;
const isServerOwner = m => m.guild?.ownerId === m.author.id;
const isAdmin = m => m.member?.permissions?.has(PermissionsBitField.Flags.Administrator);
const isCommandBlocked = id => botData.blockedUsers.includes(id);
const isSpam = c => !c || c.replace(/\W/g, '').length < MIN_MESSAGE_LENGTH || /^(.)\1+$/.test(c);
const parseTime = i => { const m = i.match(/^(\d+)(s|m|h|d)$/); return m ? {s:1000,m:60000,h:3600000,d:86400000}[m[2]] * parseInt(m[1]) : null; };

client.once('ready', () => console.log(`✅ Bot online: ${client.user.tag}`));

// --------------------------
// MESSAGE HANDLER
// --------------------------
client.on('messageCreate', async m => {
  if (!m.guild || m.author.bot) return;
  const g = m.guild.id, u = m.author.id, content = m.content.trim();

  if (botData.rewardsEnabled[g] === undefined) { botData.rewardsEnabled[g] = true; saveData(); }

  // Reward counting
  if (botData.rewardsEnabled[g] && !content.startsWith(PREFIX) && !isSpam(content)) {
    const now = Date.now();
    if (now - (lastMsgTime.get(u)||0) > MIN_TIME_BETWEEN && content !== lastMsg.get(u)) {
      if (!botData.balances[u]) botData.balances[u] = {count:0, earned:0};
      botData.balances[u].count++; lastMsg.set(u, content); lastMsgTime.set(u, now);
      const earned = Math.floor(botData.balances[u].count / REWARD_THRESH) * REWARD_AMT;
      if (earned > botData.balances[u].earned) { botData.balances[u].earned = earned; saveData(); }
    }
  }

  // Command checks
  if (!content.startsWith(PREFIX)) return;
  if (isCommandBlocked(u)) return m.reply({content:'🚫 Blocked',ephemeral:true});
  if (botData.silenceMode[g] && !isOwner(m) && !isServerOwner(m)) return;
  if (botData.disabledChannels.includes(m.channel.id) && !isAdmin(m)) return;

  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  if (!['d','cf','choose','help','gw','giveaway','reroll'].includes(cmd) && !isOwner(m)) {
    const last = userCd.get(u)||0;
    if (Date.now() - last < CD) return m.reply(`⏳ Wait ${Math.ceil((CD - (Date.now()-last))/1000)}s`);
    userCd.set(u, Date.now());
  }

  // --------------------------
  // COMMANDS — GW + REROLL FULLY ADDED
  // --------------------------
  switch (cmd) {
    case 'd': return m.reply(`🎲 Roll: **${Math.floor(Math.random()*(parseInt(args[0])||100))+1}**`);
    case 'cf': return m.reply(`🪙 Flip: **${Math.random()<0.5?'Heads':'Tails'}**`);
    case 'rewardtoggle': if (!isOwner(m)) return; botData.rewardsEnabled[g]=!botData.rewardsEnabled[g]; saveData(); return m.reply(`✅ Rewards: ${botData.rewardsEnabled[g]?'ON':'OFF'}`);
    case 'setreward': if (!isOwner(m)) return; const t=parseInt(args[0]),a=parseFloat(args[1]); if(!t||!a)return; REWARD_THRESH=t;REWARD_AMT=a; saveData(); return m.reply(`✅ Set: ${formatNum(t)} = $${a}`);
    case 'balance': const target=m.mentions.users.first()||m.author; const d=botData.balances[target.id]||{count:0,earned:0}; return m.reply({embeds:[new EmbedBuilder().setColor('#2ecc71').setTitle(`💰 ${target.username}`).addFields({name:'Messages',value:formatNum(d.count)},{name:'Earned',value:`$${d.earned.toFixed(2)}`})]});
    case 'earningslb': const sorted=Object.entries(botData.balances).sort((a,b)=>b[1].count-a[1].count).slice(0,10); if(!sorted.length)return m.reply('📊 No data'); let desc=''; for(const [id,data] of sorted) try{const u=await client.users.fetch(id); desc+=`**${u.username}** • ${formatNum(data.count)} • $${data.earned.toFixed(2)}\n`;}catch{desc+=`**Unknown** • ${formatNum(data.count)}\n`;} return m.reply({embeds:[new EmbedBuilder().setColor('#f1c40f').setTitle('🏆 Leaderboard').setDescription(desc)]});
    case 'silence': if(!isOwner(m))return; botData.silenceMode[g]=!botData.silenceMode[g]; saveData(); return m.reply(`🔇 Silence: ${botData.silenceMode[g]?'ON':'OFF'}`);
    case 'ignore': if(!isAdmin(m))return; const ig=m.mentions.users.first(); if(!ig)return; if(!botData.blockedUsers.includes(ig.id)){botData.blockedUsers.push(ig.id); saveData();} return m.reply(`✅ Blocked ${ig.username}`);
    case 'unignore': if(!isAdmin(m))return; const un=m.mentions.users.first(); if(!un)return; botData.blockedUsers=botData.blockedUsers.filter(i=>i!==un.id); saveData(); return m.reply(`✅ Unblocked ${un.username}`);
    case 'disable': if(!isAdmin(m))return; const cid=m.channel.id; if(!botData.disabledChannels.includes(cid)){botData.disabledChannels.push(cid); saveData();} return m.reply('🚫 Commands disabled');
    case 'enable': if(!isAdmin(m))return; const ce=m.channel.id; botData.disabledChannels=botData.disabledChannels.filter(i=>i!==ce); saveData(); return m.reply('✅ Commands enabled');
    case 'bully': if(!isAdmin(m))return; const b=m.mentions.users.first(); if(!b)return; const insults=["You’re the reason they put instructions on shampoo bottles 🧴","If brains were dynamite, you wouldn’t have enough to blow your nose 💣"]; for(const l of insults.slice(0,5)){await m.channel.send(`${b} ${l}`); await delay(700);} return;
    case 'dw': const opp=m.mentions.users.first(); if(!opp)return m.reply('❌ `-dw @user [rounds] [max]`'); const rnds=Math.max(1,Math.min(10,parseInt(args[1])||5)),mx=parseInt(args[2])||1000; let s1=0,s2=0; await m.reply(`🎲 Dice War: ${m.author} vs ${opp}`); for(let i=1;i<=rnds;i++){const r1=Math.floor(Math.random()*mx)+1,r2=Math.floor(Math.random()*mx)+1; if(r1>r2)s1++; else if(r2>r1)s2++; await m.channel.send(`Round ${i}: ${r1} vs ${r2}`); await delay(900);} return m.channel.send(`🏆 Final: ${s1}-${s2} | ${s1>s2?m.author:s2>s1?opp:'Draw'}`);
    case 'cw': const co=m.mentions.users.first(),p=args.find(a=>['heads','tails'].includes(a.toLowerCase())); if(!co||!p)return m.reply('❌ `-cw @user heads/tails`'); let sc1=0,sc2=0; await m.reply(`🪙 Coin War: ${m.author} vs ${co} | Pick: ${p}`); while(sc1<2&&sc2<2){const f=Math.random()<0.5?'heads':'tails'; f===p?sc1++:sc2++; await m.channel.send(`Flip: ${f} | ${sc1}-${sc2}`); await delay(900);} return m.channel.send(`🏆 Winner: ${sc1===2?m.author:co}`);
    case 'ship': const u1=m.mentions.users.first(),u2=m.mentions.users.at(1)||m.author; if(!u1)return; const pc=Math.floor(Math.random()*101); return m.reply({embeds:[new EmbedBuilder().setColor(pc>70?'#e91e63':'#f39c12').setTitle('💞 Match').setDescription(`${u1} × ${u2} = ${pc}%`)]});
    case 'choose': if(!args.length)return; return m.reply(`🎯 Picked: **${args[Math.floor(Math.random()*args.length)]}**`);

    // ✅ GIVEAWAY COMMANDS — FULLY ADDED
    case 'gw': case 'giveaway': {
      if (!isAdmin(m)) return m.reply('❌ Admin only');
      if (args.length < 4) return m.reply('❌ Usage: `-gw <prize> <time> <requirements> <host>`\nExample: `-gw 100 Coins 5m Active @luckyyy`');
      const prize = args[0], timeStr = args[1], reqs = args.slice(2, -1).join(' '), host = args.at(-1);
      const dur = parseTime(timeStr);
      if (!dur) return m.reply('❌ Time: s/m/h/d');
      const end = Math.floor((Date.now() + dur) / 1000);
      const embed = new EmbedBuilder().setColor('#FF9900').setTitle('🎉 GIVEAWAY').setDescription('React ✅ to enter').addFields({name:'Prize',value:prize},{name:'Time',value:timeStr},{name:'Host',value:host},{name:'Ends',value:`<t:${end}:R>`});
      const msg = await m.channel.send({embeds:[embed]});
      await msg.react('✅');
      m.reply('✅ Giveaway started');
      setTimeout(async () => {
        try {
          const fetched = await msg.fetch();
          const users = await fetched.reactions.cache.get('✅').users.fetch();
          const entries = users.filter(u => !u.bot);
          if (!entries.size) return fetched.reply('❌ No entries');
          fetched.reply(`🎊 Winner: ${entries.random()} | Prize: ${prize}`);
        } catch (e) { console.error(e); }
      }, dur);
      return;
    }

    case 'reroll': {
      if (!isAdmin(m)) return m.reply('❌ Admin only');
      const mid = args[0];
      if (!mid) return m.reply('❌ `-reroll <messageID>`');
      try {
        const msg = await m.channel.messages.fetch(mid);
        const users = await msg.reactions.cache.get('✅').users.fetch();
        const entries = users.filter(u => !u.bot);
        if (!entries.size) return m.reply('❌ No entries');
        return msg.reply(`🔄 New winner: ${entries.random()}`);
      } catch { return m.reply('❌ Message not found'); }
    }

    case 'help': return m.reply({embeds:[new EmbedBuilder().setColor('#6A5ACD').setTitle('✨ COMMANDS').addFields(
      {name:'🎮 Fun',value:'`-d` `-cf` `-choose` `-ship` `-dw` `-cw`'},
      {name:'💰 Rewards',value:'`-balance` `-earningslb`'},
      {name:'🎉 Giveaways',value:'`-gw` `-giveaway` `-reroll`'},
      {name:'🛡️ Admin',value:'`-silence` `-ignore` `-unignore` `-disable` `-enable` `-bully`'}
    )]});
    default: return m.reply('❌ Unknown command. Type `-help`');
  }
});

client.login(token).catch(e => console.error('❌ Login:', e.message));
