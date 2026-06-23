const {Client,GatewayIntentBits,PermissionsBitField} = require('discord.js');
const fs = require('fs');
const token = process.env.DISCORD_BOT_TOKEN;
if(!token){console.error('No token');process.exit(1);}
const client = new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
const PREFIX='-',OWNER='.luckyyy_',CD=20000,REWARD_THRESH=10000,REWARD_AMT=2;
const userCd=new Map(),disabled=new Set(),stats={r:0,f:0,start:Date.now()};
const silence=new Map(),lastMsg=new Map(),msgCd=new Map(),rewardActive=new Map();
const delay=ms=>new Promise(r=>setTimeout(r,ms));

const dataFile='./messageData.json';
let messageData={};
if(fs.existsSync(dataFile)){
  try{messageData=JSON.parse(fs.readFileSync(dataFile,'utf8'));}
  catch(e){messageData={};}
}
const save=()=>fs.writeFileSync(dataFile,JSON.stringify(messageData,null,2),'utf8');

const isAdmin=m=>m.user.username===OWNER||m.permissions.has(PermissionsBitField.Flags.Administrator);
const canSilence=(m,g)=>m.user.username===OWNER||m.id===g.ownerId;

client.once('ready',()=>console.log('Bot online: '+client.user.tag));
client.on('messageCreate',async m=>{
  if(m.author.bot||!m.guild)return;
  const g=m.guild.id;

  if(!m.content.startsWith(PREFIX)&&rewardActive.get(g)){
    const uid=m.author.id,now=Date.now();
    const lastT=msgCd.get(uid)||0,lastC=lastMsg.get(uid)||'';
    if(now-lastT>2000&&m.content.trim()!==lastC.trim()){
      if(!messageData[uid])messageData[uid]={count:0,earned:0};
      messageData[uid].count++;lastMsg.set(uid,m.content);msgCd.set(uid,now);save();
      const c=messageData[uid].count,e=Math.floor(c/REWARD_THRESH)*REWARD_AMT;
      if(e>messageData[uid].earned){
        messageData[uid].earned=e;save();
        await m.channel.send(`🎉 ${m.author}: ${c.toLocaleString()} msgs → earned $${e.toFixed(2)}`);
      }
    }
  }

  if(silence.get(g)&&!canSilence(m.member,m.guild))return;
  if(disabled.has(m.channelId)&&!isAdmin(m.member))return;

  const p=m.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd=p[0]?.toLowerCase()||'',a=p.slice(1);

  if(!['d','cf','choose'].includes(cmd)&&!isAdmin(m.member)){
    const now=Date.now(),last=userCd.get(m.author.id)||0;
    if(now-last<CD)return m.reply(`⏳ Wait ${Math.ceil((CD-now+last)/1000)}s`).catch(()=>{});
    userCd.set(m.author.id,now);
  }

  switch(cmd){
    case'd':{
      const max=parseInt(a[0])||100,r=Math.floor(Math.random()*max)+1;
      stats.r++;return m.reply(`🎲 Roll: ${r}`);
    }
    case'cf':{
      const res=Math.random()<0.5?'Heads':'Tails';
      stats.f++;return m.reply(`🪙 Flip: ${res}`);
    }
    case'choose':{
      if(!a.length)return m.reply('❌ Usage: -choose opt1 opt2');
      return m.reply(`🎯 Pick: ${a[Math.floor(Math.random()*a.length)]}`);
    }
    case'ship':{
      if(a.length<2)return m.reply('❌ Usage: -ship @user1 @user2');
      return m.reply(`💞 Compatibility: ${Math.floor(Math.random()*10)+1}/10`);
    }
    case'stats':{
      const min=Math.floor((Date.now()-stats.start)/60000);
      return m.reply(`📊 Stats\n🎲 Rolls: ${stats.r}\n🪙 Flips: ${stats.f}\n⏱️ Uptime: ${min}m`);
    }
    case'rewardtoggle':{
      if(m.author.username!==OWNER)return m.reply('❌ Only .luckyyy_');
      const s=!rewardActive.get(g);rewardActive.set(g,s);
      return m.reply(s?'✅ Rewards ON for this server':'❌ Rewards OFF');
    }
    case'balance':{
      const d=messageData[m.author.id]||{count:0,earned:0};
      return m.reply(`💰 Your Stats\nMsgs: ${d.count.toLocaleString()}\nEarned: $${d.earned.toFixed(2)}\nNext: ${((Math.floor(d.count/REWARD_THRESH)+1)*REWARD_THRESH).toLocaleString()}`);
    }
    case'earningslb':{
      if(!rewardActive.get(g))return m.reply('❌ Rewards not active here');
      const list=Object.entries(messageData).sort((x,y)=>y[1].earned-x[1].earned).slice(0,10);
      if(!list.length)return m.reply('📊 No data yet');
      let txt='🏆 Top Earners\n';
      for(let i=0;i<list.length;i++){
        const u=await client.users.fetch(list[i][0]).catch(()=>null);
        txt+=`${i+1}. ${u?.tag||'Unknown'} — $${list[i][1].earned.toFixed(2)} (${list[i][1].count.toLocaleString()})\n`;
      }
      return m.reply(txt);
    }
    case'silence':{
      if(!canSilence(m.member,m.guild))return m.reply('❌ Only Bot/Server Owner');
      const st=silence.get(g)||false;silence.set(g,!st);
      return m.reply(st?'🔊 Bot active':'🔇 Bot silenced');
    }
    case'disable':{
      if(!isAdmin(m.member))return m.reply('❌ Requires Administrator');
      disabled.add(m.channelId);return m.reply('🚫 Commands disabled here');
    }
    case'enable':{
      if(!isAdmin(m.member))return m.reply('❌ Requires Administrator');
      disabled.delete(m.channelId);return m.reply('✅ Commands enabled here');
    }
    case'bully':{
      if(!isAdmin(m.member)||!a[0])return m.reply('❌ Usage: -bully @user');
      for(let i=0;i<20;i++){await m.channel.send(`${a[0]} 👊`).catch(()=>{});await delay(600);}
      return;
    }
    case'dw':{
      const opp=a[0]||'Opponent';
      let r=parseInt(a[1])||5;r=Math.max(1,Math.min(10,r));
      const s=parseInt(a[2])||10;let p1=0,p2=0;
      await m.reply(`🎲 Dice War!\n${m.author} vs ${opp}\n${r} rounds | d${s}`);
      for(let i=1;i<=r;i++){
        const r1=Math.floor(Math.random()*s)+1,r2=Math.floor(Math.random()*s)+1;
        if(r1>r2){p1++;await m.channel.send(`Round ${i}: 🎲 ${r1} vs ${r2} — You win!`);}
        else if(r2>r1){p2++;await m.channel.send(`Round ${i}: 🎲 ${r1} vs ${r2} — ${opp} wins!`);}
        else await m.channel.send(`Round ${i}: 🎲 ${r1} vs ${r2} — Tie!`);
        await delay(1200);
      }
      const res=p1>p2?`✅ You win ${p1}-${p2}!`:p2>p1?`❌ ${opp} wins ${p2}-${p1}!`:`⚖️ Draw!`;
      return m.channel.send(`🏆 Final: You ${p1} - ${p2} ${opp}\n${res}`);
    }
    case'cw':{
      const opp=a[0]||'Opponent',side=a[1]?.toLowerCase();
      if(!['heads','tails'].includes(side))return m.reply('❌ Usage: -cw @user heads/tails');
      let u=0,o=0,round=1;
      await m.reply(`🪙 Coin War!\n${m.author} vs ${opp}\nFirst to 2 wins!`);
      while(u<2&&o<2){
        const flip=Math.random()<0.5?'Heads':'Tails';
        flip.toLowerCase()===side?u++:o++;
        await m.channel.send(`Round ${round}: 🪙 ${flip} | Score: You ${u} - ${o} ${opp}`);
        round++;await delay(1200);
      }
      return m.channel.send(u===2?`🏆 You win!`:`🏆 ${opp} wins!`);
    }
    case'help':
      return m.reply(`📖 COMMANDS

💰 REWARDS
\`-rewardtoggle\` — ON/OFF (only .luckyyy_)
\`-balance\` — Check messages & earnings
\`-earningslb\` — Top earners
*10,000 msgs = $2*

🎲 GENERAL
\`-d [max]\` — Roll dice
\`-cf\` — Flip coin
\`-choose opt...\` — Pick random
\`-dw @user [r] [s]\` — Dice War
\`-cw @user side\` — Coin War
\`-ship @u1 @u2\` — Compatibility
\`-stats\` — Bot stats

👑 ADMIN
\`-disable/enable\` — Channel control
\`-bully @user\` — Send pings

🔒 OWNER/SERVER OWNER
\`-silence\` — Mute/unmute bot`);
  }
});
client.login(token).catch(e=>console.error('Login:',e));
