const {Client,GatewayIntentBits,PermissionsBitField} = require('discord.js');
const fs = require('fs');
const path = require('path');
const token = process.env.DISCORD_BOT_TOKEN;

if(!token){console.error('❌ Token missing!');process.exit(1);}
console.log(`✅ Token loaded, length: ${token.length}`);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const PREFIX='-',OWNER='.luckyyy_',CD=20000;
let REWARD_THRESH=10000,REWARD_AMT=2;
const userCd=new Map(),lastMsg=new Map(),msgCd=new Map();
const delay=ms=>new Promise(r=>setTimeout(r,ms));

const DATA_FILE = path.join(__dirname, '..', '..', 'persistentData.json');
let botData={stats:{rolls:0,flips:0,started:Date.now()},disabled:[],silence:{},rewards:{},balances:{},rewardCfg:{t:10000,a:2}};

if(fs.existsSync(DATA_FILE)){try{const d=JSON.parse(fs.readFileSync(DATA_FILE));Object.assign(botData,d);REWARD_THRESH=botData.rewardCfg.t||10000;REWARD_AMT=botData.rewardCfg.a||2;}catch(e){console.log('ℹ️ New data file created');}}
const save=()=>{botData.rewardCfg={t:REWARD_THRESH,a:REWARD_AMT};fs.writeFileSync(DATA_FILE,JSON.stringify(botData,null,2),'utf8');};
const isAdmin=m=>m.user.username===OWNER||m.member.permissions?.has(PermissionsBitField.Flags.Administrator);
const isOwner=m=>m.user.username===OWNER;

client.once('clientReady',()=>console.log(`✅ Bot online: ${client.user.tag}`));

client.on('messageCreate',async m=>{
  if(m.author.bot||!m.guild)return;
  const g=m.guild.id,c=m.channel.id;
  if(botData.disabled.includes(c))return;

  if(!m.content.startsWith(PREFIX)){
    if(!botData.rewards[g])return;
    const u=m.author.id,now=Date.now();
    if(now-(msgCd.get(u)||0)>2000&&m.content.trim()!==(lastMsg.get(u)||'').trim()){
      if(!botData.balances[u])botData.balances[u]={count:0,earned:0};
      botData.balances[u].count++;lastMsg.set(u,m.content);msgCd.set(u,now);
      const e=Math.floor(botData.balances[u].count/REWARD_THRESH)*REWARD_AMT;
      if(e>botData.balances[u].earned){botData.balances[u].earned=e;save();}
    }
    return;
  }

  if(botData.silence[g]&&!isOwner(m))return;
  const p=m.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd=p[0]?.toLowerCase()||'',a=p.slice(1);

  if(!['d','cf','choose'].includes(cmd)&&!isAdmin(m)){
    const l=userCd.get(m.author.id)||0;
    if(Date.now()-l<CD)return m.reply(`⏳ Wait ${Math.ceil((CD-Date.now()+l)/1000)}s`).catch(()=>{});
    userCd.set(m.author.id,Date.now());
  }

  switch(cmd){
    case'd':{const x=parseInt(a[0])||100,r=Math.floor(Math.random()*x)+1;botData.stats.rolls++;save();return m.reply(`🎲 Roll: ${r}`);}
    case'cf':{const r=Math.random()<0.5?'Heads':'Tails';botData.stats.flips++;save();return m.reply(`🪙 Flip: ${r}`);}
    case'choose':{if(!a.length)return m.reply('❌ Usage: -choose opt1 opt2');return m.reply(`🎯 Pick: ${a[Math.floor(Math.random()*a.length)]}`);}
    case'ship':{if(!m.mentions.users.size)return m.reply('❌ Usage: -ship @user @user');return m.reply(`💞 Compatibility: ${Math.floor(Math.random()*100)}%`);}
    case'stats':{const u=Math.floor((Date.now()-botData.stats.started)/60000);return m.reply(`📊 Stats\n🎲 Rolls: ${botData.stats.rolls}\n🪙 Flips: ${botData.stats.flips}\n⏱️ Uptime: ${u}m`);}
    case'rewardtoggle':{if(!isOwner(m))return m.reply('❌ Only owner');botData.rewards[g]=!botData.rewards[g];save();return m.reply(botData.rewards[g]?'✅ Rewards ON':'❌ Rewards OFF');}
    case'setreward':{if(!isOwner(m))return m.reply('❌ Only owner');const t=parseInt(a[0]),v=parseFloat(a[1]);if(!t||!v||t<1||v<0)return m.reply('❌ Usage: -setreward <msgs> <$>');REWARD_THRESH=t;REWARD_AMT=v;save();return m.reply(`✅ Updated: ${t} msgs = $${v.toFixed(2)}`);}
    case'balance':{const t=m.mentions.users.first()||m.author;if(m.mentions.users.first()&&!isAdmin(m))return m.reply('❌ Admin only');const d=botData.balances[t.id]||{count:0,earned:0};const n=(Math.floor(d.count/REWARD_THRESH)+1)*REWARD_THRESH;return m.reply(`💰 ${t.username}\nMessages: ${d.count}\nEarned: $${d.earned.toFixed(2)}\nNext: ${n}`);}
    case'earningslb':{if(!botData.rewards[g])return m.reply('❌ Rewards OFF');const s=Object.entries(botData.balances).sort((a,b)=>b[1].earned-a[1].earned).slice(0,10);if(!s.length)return m.reply('📊 No data');let l='🏆 Top Earners\n';for(let i=0;i<s.length;i++){const u=await client.users.fetch(s[i][0]).catch(()=>null);l+=`${i+1}. ${u?.username||'Unknown'} — $${s[i][1].earned.toFixed(2)}\n`;}return m.reply(l);}
    case'silence':{if(!isOwner(m))return m.reply('❌ Only owner');botData.silence[g]=!botData.silence[g];save();return m.reply(botData.silence[g]?'🔇 Bot silenced':'🔊 Bot active');}
    case'disable':{if(!isAdmin(m))return m.reply('❌ Admin only');if(!botData.disabled.includes(c)){botData.disabled.push(c);save();}return m.reply('🚫 Commands disabled here');}
    case'enable':{if(!isAdmin(m))return m.reply('❌ Admin only');botData.disabled=botData.disabled.filter(i=>i!==c);save();return m.reply('✅ Commands enabled here');}
    case'bully':{if(!isAdmin(m)||!m.mentions.users.first())return m.reply('❌ Usage: -bully @user');const t=m.mentions.users.first();for(let i=0;i<8;i++){await m.channel.send(`${t} 👊`).catch(()=>{});await delay(600);}return;}
    case'dw':{const o=m.mentions.users.first()||{username:'Opponent'},r=Math.max(1,Math.min(10,parseInt(a[1])||5)),s=Math.max(2,Math.min(20,parseInt(a[2])||6));let p1=0,p2=0;await m.reply(`🎲 Dice War: ${m.author.username} vs ${o.username}`);for(let i=1;i<=r;i++){const r1=Math.floor(Math.random()*s)+1,r2=Math.floor(Math.random()*s)+1;r1>r2?p1++:r2>r1?p2++:null;await m.channel.send(`Round ${i}: ${r1}-${r2} | ${p1}-${p2}`).catch(()=>{});await delay(900);}const res=p1>p2?`✅ ${m.author.username} wins!`:p2>p1?`✅ ${o.username} wins!`:'⚖️ Draw!';return m.channel.send(`🏆 Final: ${p1}-${p2}\n${res}`);}
    case'cw':{const o=m.mentions.users.first(),side=a[1]?.toLowerCase();if(!o||!['heads','tails'].includes(side))return m.reply('❌ Usage: -cw @user heads/tails');let u=0,us=0;await m.reply(`🪙 Coin War: ${m.author.username} vs ${o.username}`);while(u<2&&us<2){const f=Math.random()<0.5?'Heads':'Tails';f===side?u++:us++;await m.channel.send(`Flip: ${f} | ${u}-${us}`).catch(()=>{});await delay(900);}return m.channel.send(u===2?`🏆 ${m.author.username} wins!`:`🏆 ${o.username} wins!`);}
    case'help':{return m.reply(`📖 **COMMANDS**

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
`);}
  }
});

client.login(token).catch(e=>console.error('❌ Login error:',e.message));
