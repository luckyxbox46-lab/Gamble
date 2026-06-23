const {Client,GatewayIntentBits,PermissionsBitField} = require('discord.js');
const token = process.env.DISCORD_BOT_TOKEN;
if(!token){console.error('No token');process.exit(1);}
const client = new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
const PREFIX = '-', OWNER = '.luckyyy_', CD = 20000, NO_CD = ['d','cf','choose'];
const userCd = new Map(), disabled = new Set(), stats = {r:0, f:0, start: Date.now()};
const silence = new Map();
const delay = ms => new Promise(r => setTimeout(r, ms));

// Check: owner OR has Administrator permission
const isAdmin = member => {
  if(member.user.username === OWNER) return true;
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
};

client.once('ready', () => console.log('Bot online: ' + client.user.tag));
client.on('messageCreate', async m => {
  if(m.author.bot || !m.content.startsWith(PREFIX) || !m.guild) return;
  const g = m.guild.id;
  if(silence.get(g) && m.author.username !== OWNER) return;
  if(disabled.has(m.channelId) && !isAdmin(m.member)) return;

  const p = m.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = p[0]?.toLowerCase() || '', a = p.slice(1);

  if(!NO_CD.includes(cmd) && !isAdmin(m.member)){
    const now = Date.now(), last = userCd.get(m.author.id) || 0;
    if(now - last < CD) return m.reply(`⏳ Wait ${Math.ceil((CD - now + last)/1000)}s`).catch(()=>{});
    userCd.set(m.author.id, now);
  }

  switch(cmd){
    case'd':{
      const max = parseInt(a[0]) || 100, r = Math.floor(Math.random() * max) + 1;
      stats.r++; return m.reply(`🎲 **Roll:** ${r}`);
    }
    case'cf':{
      const res = Math.random() < 0.5 ? 'Heads' : 'Tails';
      stats.f++; return m.reply(`🪙 **Flip:** ${res}`);
    }
    case'choose':{
      if(!a.length) return m.reply('❌ Usage: `-choose opt1 opt2 ...`');
      return m.reply(`🎯 **I pick:** ${a[Math.floor(Math.random() * a.length)]}`);
    }
    case'ship':{
      if(a.length < 2) return m.reply('❌ Usage: `-ship @user1 @user2`');
      const score = Math.floor(Math.random() * 10) + 1;
      return m.reply(`💞 **Compatibility:** ${score}/10`);
    }
    case'stats':{
      const min = Math.floor((Date.now() - stats.start)/60000);
      return m.reply(`📊 **Bot Stats**\n🎲 Rolls: ${stats.r}\n🪙 Flips: ${stats.f}\n⏱️ Uptime: ${min} min`);
    }
    case'silence':{
      if(m.author.username !== OWNER) return m.reply('❌ Only `.luckyyy_` can use this command');
      const st = silence.get(g) || false; silence.set(g, !st);
      return m.reply(st ? '🔊 **Server active again**' : '🔇 **Whole server silenced**');
    }
    case'disable':{
      if(!isAdmin(m.member)) return m.reply('❌ Requires Administrator permission');
      disabled.add(m.channelId); return m.reply('🚫 **Commands disabled in this channel**');
    }
    case'enable':{
      if(!isAdmin(m.member)) return m.reply('❌ Requires Administrator permission');
      disabled.delete(m.channelId); return m.reply('✅ **Commands enabled here**');
    }
    case'bully':{
      if(!isAdmin(m.member) || !a[0]) return m.reply('❌ Usage: `-bully @user` | Requires Administrator');
      for(let i = 0; i < 20; i++){ await m.channel.send(`${a[0]} 👊`).catch(()=>{}); await delay(600); }
      return;
    }
    case'dw':{
      const opp = a[0] || 'Opponent';
      let rounds = parseInt(a[1]) || 5; rounds = Math.max(1, Math.min(10, rounds));
      const sides = parseInt(a[2]) || 10; let p1 = 0, p2 = 0;
      await m.reply(`🎲 **Dice War!**\n${m.author} vs ${opp}\n${rounds} rounds — rolling d${sides}`);
      for(let i = 1; i <= rounds; i++){
        const r1 = Math.floor(Math.random() * sides) + 1, r2 = Math.floor(Math.random() * sides) + 1;
        if(r1 > r2) { p1++; await m.channel.send(`Round ${i}: 🎲 ${r1} vs 🎲 ${r2} — **You take the round!**`); }
        else if(r2 > r1) { p2++; await m.channel.send(`Round ${i}: 🎲 ${r1} vs 🎲 ${r2} — **${opp} takes the round!**`); }
        else await m.channel.send(`Round ${i}: 🎲 ${r1} vs 🎲 ${r2} — **Tie! No point**`);
        await delay(1200);
      }
      const res = p1 > p2 ? `✅ **You win ${p1}-${p2}!**` : p2 > p1 ? `❌ **${opp} wins ${p2}-${p1}!**` : `⚖️ **Draw!**`;
      return m.channel.send(`🏆 **Final Score:** You ${p1} – ${p2} ${opp}\n${res}`);
    }
    case'cw':{
      const opp = a[0] || 'Opponent', side = a[1]?.toLowerCase();
      if(!['heads','tails'].includes(side)) return m.reply('❌ Usage: `-cw @user heads/tails`');
      let u = 0, o = 0, round = 1;
      await m.reply(`🪙 **Coin War!**\n${m.author} vs ${opp}\nFirst to 2 wins!`);
      while(u < 2 && o < 2){
        const flip = Math.random() < 0.5 ? 'Heads' : 'Tails';
        flip.toLowerCase() === side ? u++ : o++;
        await m.channel.send(`Round ${round}: 🪙 **${flip}** | Score: You ${u} – ${o} ${opp}`);
        round++; await delay(1200);
      }
      return m.channel.send(u === 2 ? `🏆 **You win the Coin War!**` : `🏆 **${opp} wins the Coin War!**`);
    }
    case'help':
      return m.reply(`📖 **All Bot Commands**

🎲 **General**
\`-d [max]\` — Roll dice (default 100)
\`-cf\` — Flip a coin
\`-choose opt1 opt2 ...\` — Pick randomly
\`-dw @user [rounds] [sides]\` — Dice War (max 10 rounds)
\`-cw @user heads/tails\` — Coin War (first to 2 wins)
\`-ship @u1 @u2\` — Compatibility 1–10
\`-stats\` — View stats & uptime

👑 **Admin / Administrator**
\`-disable\` — Stop commands in this channel
\`-enable\` — Re-enable commands
\`-bully @user\` — Send 20 pings

🔒 **Owner Only**
\`-silence\` — Mute bot for the whole server`);
  }
});
client.login(token).catch(e => console.error('Login:', e));
