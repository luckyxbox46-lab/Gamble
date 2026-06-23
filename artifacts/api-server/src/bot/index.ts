const {Client,GatewayIntentBits}=require('discord.js');
const token=process.env.DISCORD_BOT_TOKEN;
if(!token){console.error('No token');process.exit(1);}
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
const PREFIX='-',OWNER='.luckyyy_',CD=20000,NO_CD=['d','cf','choose'];
const userCd=new Map(),disabled=new Set(),stats={r:0,f:0,start:Date.now()};
const silence=new Map();

client.once('ready',()=>console.log('Bot online: '+client.user.tag));
client.on('messageCreate',async m=>{
  if(m.author.bot||!m.content.startsWith(PREFIX)||!m.guild)return;
  const g=m.guild.id;
  if(silence.get(g)&&m.author.username!==OWNER)return;
  if(disabled.has(m.channelId)&&m.author.username!==OWNER)return;
  const p=m.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd=p[0]?.toLowerCase()||'',a=p.slice(1);
  if(!NO_CD.includes(cmd)&&m.author.username!==OWNER){
    const now=Date.now(),last=userCd.get(m.author.id)||0;
    if(now-last<CD)return m.reply(`Wait ${Math.ceil((CD-now+last)/1000)}s`).catch(()=>{});
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
      if(!a.length)return m.reply('Use: -choose opt1 opt2');
      return m.reply(`🎯 Pick: ${a[Math.floor(Math.random()*a.length)]}`);
    }
    case'cw':{
      const side=a[1]?.toLowerCase();
      if(!['heads','tails'].includes(side))return m.reply('Use: -cw @user heads/tails');
      const res=Math.random()<0.5?'Heads':'Tails',win=res===side;
      return m.reply(`🪙 Coin War: ${res}\n${win?'✅ Win':'❌ Lose'}`);
    }
    case'ship':{
      if(a.length<2)return m.reply('Use: -ship @u1 @u2');
      return m.reply(`💞 Match: ${Math.floor(Math.random()*10)+1}/10`);
    }
    case'stats':{
      const min=Math.floor((Date.now()-stats.start)/60000);
      return m.reply(`📊 Stats\nRolls: ${stats.r}\nFlips: ${stats.f}\nUptime: ${min}m`);
    }
    case'silence':{
      if(m.author.username!==OWNER)return m.reply('❌ Only .luckyyy_');
      const st=silence.get(g)||false;silence.set(g,!st);
      return m.reply(!st?'🔇 Whole server silenced':'🔊 Server active');
    }
    case'disable':{
      if(m.author.username!==OWNER)return m.reply('❌ Owner only');
      disabled.add(m.channelId);return m.reply('🚫 Disabled here');
    }
    case'enable':{
      if(m.author.username!==OWNER)return m.reply('❌ Owner only');
      disabled.delete(m.channelId);return m.reply('✅ Enabled here');
    }
    case'bully':{
      if(m.author.username!==OWNER||!a[0])return m.reply('❌ Use: -bully @user');
      for(let i=0;i<20;i++)await m.channel.send(`${a[0]} 👊`).catch(()=>{});
      return;
    }
    case'dw':{
      const opp=a[0]||'Opponent';
      let r=parseInt(a[1])||5;r=Math.max(1,Math.min(10,r));
      const s=parseInt(a[2])||10;let p1=0,p2=0;
      let out=`🎲 **Dice War!**\n${m.author} vs ${opp}\n${r} rounds — d${s}\n\nRolling...\n`;
      for(let i=1;i<=r;i++){
        const r1=Math.floor(Math.random()*s)+1,r2=Math.floor(Math.random()*s)+1;
        if(r1>r2){p1++;out+=`Round ${i}: 🎲 ${r1} vs 🎲 ${r2} — **You win round!**\n`;}
        else if(r2>r1){p2++;out+=`Round ${i}: 🎲 ${r1} vs 🎲 ${r2} — **${opp} wins round!**\n`;}
        else{out+=`Round ${i}: 🎲 ${r1} vs 🎲 ${r2} — **Tie!**\n`;}
      }
      out+=`\n🏆 Final: **You ${p1} – ${p2} ${opp}**\n`;
      out+=p1>p2?`✅ **You win ${p1}-${p2}!**`:p2>p1?`❌ **${opp} wins ${p2}-${p1}!**`:`⚖️ **Draw!**`;
      return m.reply(out);
    }
    case'help':
      return m.reply(`📖 Commands\n-d [max] Roll\n-cf Flip\n-choose opt...\n-dw @user [1-10] [sides]\n-cw @user heads/tails\n-ship @u1 @u2\n-stats\n🔇 -silence\nAdmin:\n-disable/enable\n-bully @user`);
  }
});
client.login(token).catch(e=>console.error('Login:',e));
