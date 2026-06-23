const {Client,GatewayIntentBits}=require('discord.js');
const token=process.env.DISCORD_BOT_TOKEN;
if(!token){console.error('No token');process.exit(1);}
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
const PREFIX='-',OWNER='.luckyyy_',CD=20000,NO_CD=['d','cf','choose'];
const userCd=new Map(),disabledChan=new Set(),stats={rolls:0,flips:0,started:Date.now()};
const serverSilence=new Map();

client.once('ready',()=>console.log('Bot online: '+client.user.tag));
client.on('messageCreate',async msg=>{
  if(msg.author.bot||!msg.content.startsWith(PREFIX)||!msg.guild)return;
  const guildId=msg.guild.id;
  if(serverSilence.get(guildId)&&msg.author.username!==OWNER)return;
  if(disabledChan.has(msg.channelId)&&msg.author.username!==OWNER)return;

  const parts=msg.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd=parts[0]?.toLowerCase()||'',args=parts.slice(1);

  if(!NO_CD.includes(cmd)&&msg.author.username!==OWNER){
    const now=Date.now(),last=userCd.get(msg.author.id)||0;
    if(now-last<CD)return msg.reply(`Wait ${Math.ceil((CD-now+last)/1000)}s`).catch(()=>{});
    userCd.set(msg.author.id,now);
  }

  switch(cmd){
    case'd':{
      const max=parseInt(args[0])||100,r=Math.floor(Math.random()*max)+1;
      stats.rolls++;return msg.reply(`🎲 Roll: ${r}`);
    }
    case'cf':{
      const res=Math.random()<0.5?'Heads':'Tails';
      stats.flips++;return msg.reply(`🪙 Flip: ${res}`);
    }
    case'choose':{
      if(!args.length)return msg.reply('Use: -choose opt1 opt2');
      return msg.reply(`🎯 Pick: ${args[Math.floor(Math.random()*args.length)]}`);
    }
    case'dw':{
      const r=parseInt(args[1])||1,s=parseInt(args[2])||6;
      let p1=0,p2=0;for(let i=0;i<r;i++){p1+=Math.floor(Math.random()*s)+1;p2+=Math.floor(Math.random()*s)+1;}
      const w=p1>p2?'You win':p1<p2?'Opponent wins':'Draw';
      return msg.reply(`⚔️ Dice War\nYou: ${p1}\n${args[0]||'Opp'}: ${p2}\n${w}`);
    }
    case'cw':{
      const side=args[1]?.toLowerCase();
      if(!['heads','tails'].includes(side))return msg.reply('Use: -cw @user heads/tails');
      const res=Math.random()<0.5?'Heads':'Tails',win=res===side;
      return msg.reply(`🪙 Coin War: ${res}\n${win?'✅ Win':'❌ Lose'}`);
    }
    case'ship':{
      if(args.length<2)return msg.reply('Use: -ship @u1 @u2');
      return msg.reply(`💞 Match: ${Math.floor(Math.random()*10)+1}/10`);
    }
    case'stats':{
      const m=Math.floor((Date.now()-stats.started)/60000);
      return msg.reply(`📊 Stats\nRolls: ${stats.rolls}\nFlips: ${stats.flips}\nUptime: ${m}m`);
    }
    case'silence':{
      if(msg.author.username!==OWNER)return msg.reply('❌ Only .luckyyy_ can use this');
      const state=serverSilence.get(guildId)||false;
      serverSilence.set(guildId,!state);
      return msg.reply(!state?'🔇 Bot SILENCED for WHOLE SERVER':'🔊 Bot ACTIVE again');
    }
    case'disable':{
      if(msg.author.username!==OWNER)return msg.reply('❌ Owner only');
      disabledChan.add(msg.channelId);return msg.reply('🚫 Disabled here');
    }
    case'enable':{
      if(msg.author.username!==OWNER)return msg.reply('❌ Owner only');
      disabledChan.delete(msg.channelId);return msg.reply('✅ Enabled here');
    }
    case'bully':{
      if(msg.author.username!==OWNER||!args[0])return msg.reply('❌ Owner only | Use: -bully @user');
      for(let i=0;i<20;i++)await msg.channel.send(`${args[0]} 👊`).catch(()=>{});
      return;
    }
    case'help':
      return msg.reply(`📖 Commands\n-d [max] Roll\n-cf Flip\n-choose opt...\n-dw @user rounds sides\n-cw @user heads/tails\n-ship @u1 @u2\n-stats\n🔇 -silence (owner only, whole server)\nAdmin:\n-disable/enable\n-bully @user`);
  }
});
client.login(token).catch(e=>console.error('Login error:',e));
