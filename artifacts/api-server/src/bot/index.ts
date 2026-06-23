const { Client, GatewayIntentBits } = require('discord.js');

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('ERROR: DISCORD_BOT_TOKEN not set');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = '-';
const OWNER = '.luckyyy_';
const CD = 20000;
const NO_CD = ['d', 'cf'];
const userCd = new Map();

client.once('ready', () => {
  console.log('Bot online: ' + client.user.tag);
});

client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const parts = msg.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = parts[0] ? parts[0].toLowerCase() : '';
  const args = parts.slice(1);

  if (msg.author.username !== OWNER && !NO_CD.includes(cmd)) {
    const now = Date.now();
    const last = userCd.get(msg.author.id) || 0;
    if (now - last < CD) {
      const wait = Math.ceil((CD - now + last) / 1000);
      return msg.reply('Wait ' + wait + 's').catch(() => {});
    }
    userCd.set(msg.author.id, now);
  }

  runCommand(cmd, args, msg);
});

function runCommand(cmd, args, msg) {
  switch(cmd) {
    case 'help':
      return msg.reply('📜 Commands:\n-d Roll\n-cf Flip\n-choose Pick\n-disable/enable Channel\n-stats Info\n-bully Insult\n-cw Coin War\n-ship Pair\n-ignore/unignore User\n-dw Dice War\n-silence Toggle');
    case 'd':
      const max = parseInt(args[0]) || 100;
      return msg.reply('🎲 Roll: ' + (Math.floor(Math.random() * max) + 1));
    case 'cf':
      return msg.reply('🪙 Flip: ' + (Math.random() < 0.5 ? 'Heads' : 'Tails'));
    case 'choose':
      if (!args.length) return msg.reply('❌ Use: -choose opt1 opt2...');
      return msg.reply('🎯 Pick: ' + args[Math.floor(Math.random() * args.length)]);
    case 'disable':
      if (msg.author.username !== OWNER) return msg.reply('❌ Owner only');
      return msg.reply('🚫 Channel disabled');
    case 'enable':
      if (msg.author.username !== OWNER) return msg.reply('❌ Owner only');
      return msg.reply('✅ Channel enabled');
    case 'stats':
      return msg.reply('📊 Bot running fine');
    case 'bully':
      const insults = ['Nice try', 'Not today', 'Calm down'];
      return msg.reply(insults[Math.floor(Math.random() * insults.length)]);
    case 'cw':
      return msg.reply('⚔️ Coin war started');
    case 'ship':
      if (args.length < 2) return msg.reply('❌ Use: -ship @user1 @user2');
      return msg.reply('❤️ Match: ' + Math.floor(Math.random() * 101) + '%');
    case 'ignore':
    case 'unignore':
      if (msg.author.username !== OWNER) return msg.reply('❌ Owner only');
      return msg.reply('✅ Done');
    case 'dw':
      const a = Math.floor(Math.random() * 20) + 1;
      const b = Math.floor(Math.random() * 20) + 1;
      const res = a > b ? 'You win' : a < b ? 'Opponent wins' : 'Draw';
      return msg.reply('🎲 Dice: You=' + a + ' | Them=' + b + '\n' + res);
    case 'stfu':
    case 'silence':
      if (msg.author.username !== OWNER) return msg.reply('❌ Owner only');
      return msg.reply('🔇/🔊 Silence toggled');
    default: return;
  }
}

client.login(token).catch(err => {
  console.error('Login error:', err);
  process.exit(1);
});
