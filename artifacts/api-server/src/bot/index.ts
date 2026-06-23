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
  console.log('Bot online as: ' + client.user.tag);
});

client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;

  // Owner bypass
  if (msg.author.username === OWNER) {
    const parts = msg.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = parts[0] ? parts[0].toLowerCase() : '';
    if (cmd === 'help') return msg.reply('Commands: -d -cf -help');
    if (cmd === 'd') return msg.reply('Roll: ' + (Math.floor(Math.random() * 100) + 1));
    if (cmd === 'cf') return msg.reply('Coinflip: ' + (Math.random() < 0.5 ? 'Heads' : 'Tails'));
    return;
  }

  if (!msg.content.startsWith(PREFIX)) return;

  const parts = msg.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = parts[0] ? parts[0].toLowerCase() : '';
  if (!cmd) return;

  // Cooldown
  if (!NO_CD.includes(cmd)) {
    const now = Date.now();
    const last = userCd.get(msg.author.id) || 0;
    if (now - last < CD) {
      const wait = Math.ceil((CD - now + last) / 1000);
      return msg.reply('Wait ' + wait + 's').catch(() => {});
    }
    userCd.set(msg.author.id, now);
  }

  if (cmd === 'help') return msg.reply('Commands: -d -cf -help');
  if (cmd === 'd') return msg.reply('Roll: ' + (Math.floor(Math.random() * 100) + 1));
  if (cmd === 'cf') return msg.reply('Coinflip: ' + (Math.random() < 0.5 ? 'Heads' : 'Tails'));
});

client.login(token).catch(err => {
  console.error('Login error:', err);
  process.exit(1);
});
