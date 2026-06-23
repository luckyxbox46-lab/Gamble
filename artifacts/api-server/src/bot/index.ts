const {Client,GatewayIntentBits,PermissionsBitField} = require('discord.js');
const fs = require('fs');
const path = require('path');
const token = process.env.DISCORD_BOT_TOKEN;
if(!token){console.error('No token');process.exit(1);}

const client = new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
const PREFIX='-',OWNER='.luckyyy_',CD=20000;
let REWARD_THRESH=10000,REWARD_AMT=2;
const userCd=new Map(),lastMsg=new Map(),msgCd=new Map();
const delay=ms=>new Promise(r=>setTimeout(r,ms));

const DATA_FILE = path.join(__dirname, '..', '..', 'persistentData.json');

let botData = {
  stats: { rolls:0, flips:0, started: Date.now() },
  disabledChannels: [],
  silenceMode: {},
  rewardsEnabled: {},
  userBalances: {},
  rewardSettings: { threshold:10000, amount:2 }
};

if(fs.existsSync(DATA_FILE)){
  try{
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    Object.assign(botData, saved);
    REWARD_THRESH = botData.rewardSettings.threshold || 10000;
    REWARD_AMT = botData.rewardSettings.amount || 2;
  }catch(e){}
}

const saveData = () => {
  botData.rewardSettings = { threshold:REWARD_THRESH, amount:REWARD_AMT };
  fs.writeFileSync(DATA_FILE, JSON.stringify(botData,null,2),'utf8');
};

const isAdmin = m => m.user.username === OWNER || m.member.permissions.has('Administrator');
const isOwner = m => m.user.username === OWNER;

client.once('ready', () => console.log('✅ Bot online'));

client.on('messageCreate', async m => {
  if(m.author.bot || !m.guild) return;
  const guildId = m.guild.id;
  const channelId = m.channel.id;

  if(botData.disabledChannels.includes(channelId)) return;

  if(!m.content.startsWith(PREFIX)){
    if(!botData.rewardsEnabled[guildId]) return;
    const userId = m.author.id;
    const now = Date.now();
    const lastTime = msgCd.get(userId)||0;
    const lastText = lastMsg.get(userId)||'';

    if(now-lastTime>2000 && m.content.trim()!==lastText.trim()){
      if(!botData.userBalances[userId]) botData.userBalances[userId]={count:0,earned:0};
      botData.userBalances[userId].count++;
      lastMsg.set(userId,m.content);
      msgCd.set(userId,now);
      const earned = Math.floor(botData.userBalances[userId].count/REWARD_THRESH)*REWARD_AMT;
      if(earned>botData.userBalances[userId].earned){
        botData.userBalances[userId].earned=earned;
        saveData();
      }
    }
    return;
  }

  if(botData.silenceMode[guildId] && !isOwner(m)) return;

  const args = m.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  if(!['d','cf','choose'].includes(cmd) && !isAdmin(m)){
    const lastCmd = userCd.get(m.author.id)||0;
    if(Date.now()-lastCmd<CD) return m.reply(`⏳ Wait ${Math.ceil((CD-(Date.now()-lastCmd))/1000)}s`).catch(()=>{});
    userCd.set(m.author.id,Date.now());
  }

  switch(cmd){
    case 'd': {
      const max = parseInt(args[0])||100;
      const roll = Math.floor(Math.random()*max)+1;
      botData.stats.rolls++; saveData();
      return m.reply(`🎲 Roll: ${roll}`);
    }
    case 'cf': {
      const res = Math.random()<0.5?'Heads':'Tails';
      botData.stats.flips++; saveData();
      return m.reply(`🪙 Flip: ${res}`);
    }
    case 'choose': {
      if(args.length<2) return m.reply('❌ Usage: -choose opt1 opt2');
      return m.reply(`🎯 Pick: ${args[Math.floor(Math.random()*args.length)]}`);
    }
    case 'ship': {
      if(!m.mentions.users.size) return m.reply('❌ Usage: -ship @user @user');
      return m.reply(`💞 Compatibility: ${Math.floor(Math.random()*100)}%`);
    }
    case 'stats': {
      const uptime = Math.floor((Date.now()-botData.stats.started)/60000);
      return m.reply(`📊 Stats\n🎲 Rolls: ${botData.stats.rolls}\n🪙 Flips: ${botData.stats.flips}\n⏱️ Uptime: ${uptime}m`);
    }
    case 'rewardtoggle': {
      if(!isOwner(m)) return m.reply('❌ Only owner');
      const guildId = m.guild.id;
      botData.rewardsEnabled[guildId] = !botData.rewardsEnabled[guildId];
      saveData();
      return m.reply(botData.rewardsEnabled[guildId] ? '✅ Rewards ON' : '❌ Rewards OFF');
    }
    case 'setreward': {
      if(!isOwner(m)) return m.reply('❌ Only owner');
      const newT = parseInt(args[0]), newA = parseFloat(args[1]);
      if(!newT||!newA||newT<1||newA<0) return m.reply('❌ Usage: -setreward <msgs> <$>');
      REWARD_THRESH=newT; REWARD_AMT=newA; saveData();
      return m.reply(`✅ Updated: ${REWARD_THRESH} msgs = $${REWARD_AMT.toFixed(2)}`);
    }
    case 'balance': {
      const target = m.mentions.users.first()||m.author;
      if(m.mentions.users.first()&&!isAdmin(m)) return m.reply('❌ Admin only');
      const data = botData.userBalances[target.id]||{count:0,earned:0};
      const next = (Math.floor(data.count/REWARD_THRESH)+1)*REWARD_THRESH;
      return m.reply(`💰 ${target.username}\nMessages: ${data.count}\nEarned: $${data.earned.toFixed(2)}\nNext: ${next}`);
    }
    case 'earningslb': {
      if(!botData.rewardsEnabled[m.guild.id]) return m.reply('❌ Rewards OFF');
      const sorted = Object.entries(botData.userBalances).sort((a,b)=>b[1].earned-a[1].earned).slice(0,10);
      if(!sorted.length) return m.reply('📊 No data yet');
      let list = '🏆 Top Earners\n';
      for(let i=0;i<sorted.length;i++){
        const u = await client.users.fetch(sorted[i][0]).catch(()=>null);
        list += `${i+1}. ${u?.username||'Unknown'} — $${sorted[i][1].earned.toFixed(2)}\n`;
      }
      return m.reply(list);
    }
    case 'silence': {
      if(!isOwner(m)) return m.reply('❌ Only owner');
      const guildId = m.guild.id;
      botData.silenceMode[guildId] = !botData.silenceMode[guildId];
      saveData();
      return m.reply(botData.silenceMode[guildId] ? '🔇 Bot silenced' : '🔊 Bot active');
    }
    case 'disable': {
      if(!isAdmin(m)) return m.reply('❌ Admin only');
      const id = m.channel.id;
      if(!botData.disabledChannels.includes(id)){
        botData.disabledChannels.push(id); saveData();
        return m.reply('🚫 Commands disabled here');
      }
      return m.reply('ℹ️ Already disabled');
    }
    case 'enable': {
      if(!isAdmin(m)) return m.reply('❌ Admin only');
      const id = m.channel.id;
      botData.disabledChannels = botData.disabledChannels.filter(c=>c!==id); saveData();
      return m.reply('✅ Commands enabled here');
    }
    case 'bully': {
      if(!isAdmin(m)||!m.mentions.users.first()) return m.reply('❌ Usage: -bully @user');
      const t = m.mentions.users.first();
      for(let i=0;i<8;i++){ await m.channel.send(`${t} 👊`).catch(()=>{}); await delay(600); }
      return;
    }
    case 'dw': {
      const opp = m.mentions.users.first()||{username:'Opponent'};
      const r = Math.max(1,Math.min(10,parseInt(args[1])||5));
      const s = Math.max(2,Math.min(20,parseInt(args[2])||6));
      let p1=0,p2=0;
      await m.reply(`🎲 Dice War: ${m.author.username} vs ${opp.username}`);
      for(let i=1;i<=r;i++){
        const r1 = Math.floor(Math.random()*s)+1;
        const r2 = Math.floor(Math.random()*s)+1;
        r1>r2?p1++:r2>r1?p2++:null;
        await m.channel.send(`Round ${i}: ${r1}-${r2} | ${p1}-${p2}`).catch(()=>{});
        await delay(900);
      }
      const res = p1>p2?`✅ ${m.author.username} wins!`:p2>p1?`✅ ${opp.username} wins!`:'⚖️ Draw!';
      return m.channel.send(`🏆 Final: ${p1}-${p2}\n${res}`);
    }
    case 'cw': {
      const opp = m.mentions.users.first();
      const side = args[1]?.toLowerCase();
      if(!opp||!['heads','tails'].includes(side)) return m.reply('❌ Usage: -cw @user heads/tails');
      let u=0,o=0;
      await m.reply(`🪙 Coin War: ${m.author.username} vs ${opp.username}`);
      while(u<2&&o<2){
        const flip = Math.random()<0.5?'Heads':'Tails';
        flip===side?u++:o++;
        await m.channel.send(`Flip: ${flip} | ${u}-${o}`).catch(()=>{});
        await delay(900);
      }
      return m.channel.send(u===2?`🏆 ${m.author.username} wins!`:`🏆 ${opp.username} wins!`);
    }
    case 'help': {
      return m.reply(`📖 **COMMANDS**

💰 **REWARDS**
\`-rewardtoggle\` (OWNER)
\`-setreward <msgs> <$\` (OWNER)
\`-balance\` / \`-balance @user\`
\`-earningslb\`
*Default: 10,000 = $2.00*

🎲 **GENERAL**
\`-d [max]\` • \`-cf\` • \`-choose\`
\`-ship\` • \`-stats\` • \`-dw\` • \`-cw\`

👑 **ADMIN**
\`-disable\` • \`-enable\` • \`-bully\`

🔒 **OWNER**
\`-silence\`
`);
    }
  }
});

client.login(token).catch(e=>console.error('❌ Login error:',e));
