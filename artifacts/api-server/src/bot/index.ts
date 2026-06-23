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

let botData={stats:{r:0,f:0,start:Date.now()},disabled:[],silence:{},rewardOn:{},messages:{}};

if(fs.existsSync(DATA_FILE)){
  try{
    const loaded = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    botData = { ...botData, ...loaded };
    if(loaded.rewardConfig){
      REWARD_THRESH = loaded.rewardConfig.threshold || 10000;
      REWARD_AMT = loaded.rewardConfig.amount || 2;
    }
    console.log('✅ Loaded saved data');
  }catch(e){console.warn('⚠️ Starting new data file');}
}

const save=()=>{
  try{
    botData.rewardConfig = { threshold: REWARD_THRESH, amount: REWARD_AMT };
    fs.writeFileSync(DATA_FILE, JSON.stringify(botData,null,2),'utf8');
  }catch(e){console.error('❌ Save error:',e);}
};

const isAdmin=m=>m.user.username===OWNER||m.permissions?.has(PermissionsBitField.Flags.Administrator);
const canSilence=(m,g)=>m.user.username===OWNER||m.id===g.ownerId;

client.once('ready',()=>console.log('✅ Bot online: '+client.user.tag));
client.on('messageCreate',async m=>{
  if(m.author.bot||!m.guild)return;
  const g=m.guild.id;

  if(!m.content.startsWith(PREFIX)){
    if(!botData.rewardOn[g])return;
    const uid=m.author.id,now=Date.now();
    const lastT=msgCd.get(uid)||0,lastC=lastMsg.get(uid)||'';
    if(now-lastT>2000&&m.content.trim()!==lastC.trim()){
      if(!botData.messages[uid])botData.messages[uid]={count:0,earned:0};
      botData.messages[uid].count++;lastMsg.set(uid,m.content);msgCd.set(uid,now);
      const c=botData.messages[uid].count;
      const earned=Math.floor(c/REWARD_THRESH)*REWARD_AMT;
      if(earned>botData.messages[uid].earned){
        botData.messages[uid].earned=earned;save();
        await m.channel.send(`🎉 ${m.author}: ${c.toLocaleString()} msgs → $${earned.toFixed(2)}`).catch(()=>{});
      }
    }
    return;
  }

  if(botData.silence[g]&&!canSilence(m.member,m.guild))return;
  if(botData.disabled.includes(m.channelId)&&!isAdmin(m.member))return;

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
      botData.stats.r++;save();return m.reply(`🎲 Roll: ${r}`);
    }
    case'cf':{
      const res=Math.random()<0.5?'Heads':'Tails';
      botData.stats.f++;save();return m.reply(`🪙 Flip: ${res}`);
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
      const min=Math.floor((Date.now()-botData.stats.start)/60000);
      return m.reply(`📊 Stats\n🎲 Rolls: ${botData.stats.r}\n🪙 Flips: ${botData.stats.f}\n⏱️ Uptime: ${min}m`);
    }
    case'rewardtoggle':{
      if(m.author.username!==OWNER)return m.reply('❌ Only .luckyyy_');
      botData.rewardOn[g]=!botData.rewardOn[g];save();
      return m.reply(botData.rewardOn[g]?'✅ Rewards ON':'❌ Rewards OFF');
    }
    case'setreward':{
      if(m.author.username!==OWNER)return m.reply('❌ Only owner can change rewards');
      const newThreshold = parseInt(a[0]);
      const newAmount = parseFloat(a[1]);
      if(!newThreshold || !newAmount || newThreshold < 1 || newAmount < 0){
        return m.reply('❌ Usage: -setreward <msgs> <$>\nExample: -setreward 5000 1.5');
      }
      REWARD_THRESH = newThreshold;
      REWARD_AMT = newAmount;
      save();
      return m.reply(`✅ Updated: ${REWARD_THRESH} msgs = $${REWARD_AMT.toFixed(2)}`);
    }
    case'balance':{
      let uid=m.author.id;
      if(a[0]&&m.mentions.users.first()){
        if(!isAdmin(m.member))return m.reply('❌ Admins only');
        uid=m.mentions.users.first().id;
      }
      const d=botData.messages[uid]||{count:0,earned:0};
      const next=(Math.floor(d.count/REWARD_THRESH)+1)*REWARD_THRESH;
      return m.reply(`💰 Balance\nMessages: ${d.count.toLocaleString()}\nEarned: $${d.earned.toFixed(2)}\nNext: ${next.toLocaleString()}`);
    }
    case'earningslb':{
      if(!botData.rewardOn[g])return m.reply('❌ Rewards off');
      const list=Object.entries(botData.messages).sort((x,y)=>y[1].earned-x[1].earned).slice(0,10);
      if(!list.length)return m.reply('📊 No data');
      let txt='🏆 Top Earners\n';
      for(let i=0;i<list.length;i++){
        const u=await client.users.fetch(list[i][0]).catch(()=>null);
        txt+=`${i+1}. ${u?.tag||'Unknown'} — $${list[i][1].earned.toFixed(2)} (${list[i][1].count.toLocaleString()})\n`;
      }
      return m.reply(txt);
    }
    case'silence':{
      if(!canSilence(m.member,m.guild))return m.reply('❌ Only owners');
      botData.silence[g]=!botData.silence[g];save();
      return m.reply(botData.silence[g]?'🔇 Bot silenced':'🔊 Bot active');
    }
    case'disable':{
      if(!isAdmin(m.member))return m.reply('❌ Admin only');
      if(!botData.disabled.includes(m.channelId)){botData.disabled.push(m.channelId);save();}
      return m.reply('🚫 Commands disabled here');
    }
    case'enable':{
      if(!isAdmin(m.member))return m.reply('❌ Admin only');
      botData.disabled=botData.disabled.filter(id=>id!==m.channelId);save();
      return m.reply('✅ Commands enabled here');
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
      await m.reply(`🎲 Dice War!\n${m.author} vs ${opp}\n${r} rounds d${s}`);
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
      await m.reply(`🪙 Coin War!\n${m.author} vs ${opp}\nFirst to 2 wins`);
      while(u<2&&o<2){
        const flip=Math.random()<0.5?'Heads':'Tails';
        flip.toLowerCase()===side?u++:o++;
        await m.channel.send(`Round ${round}: 🪙 ${flip} | Score: You ${u} - ${o} ${opp}`);
        round++;await delay(1200);
      }
      return m.channel.send(u===2?`🏆 You win!`:`🏆 ${opp} wins!`);
    }
    case'help':{
      return m.reply(`📖 COMMANDS

💰 REWARDS
-rewardtoggle (OWNER)
-setreward <msgs> <$> (OWNER)
-balance / -balance @user (ADMIN)
-earningslb
*Default: 10,000 msgs = $2*

🎲 GENERAL
-d / -cf / -choose / -ship / -stats
-dw / -cw

👑 ADMIN
-disable / -enable / -bully

🔒 OWNER
-silence`);
    }
  }
});
client.login(token).catch(e=>console.error('❌ Login error:',e));
