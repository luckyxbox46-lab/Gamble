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

client.once('ready', () => {
  console.log('Bot online: ' + client.user.tag);
});

client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const input = msg.content.slice(PREFIX.length).trim().toLowerCase();
  if (!input) return;

  if (input === 'help') return msg.reply('Commands:\n-d = Roll dice\n-cf = Flip coin');
  if (input === 'd') return msg.reply('Roll: ' + (Math.floor(Math.random() * 100) + 1));
  if (input === 'cf') return msg.reply('Coinflip: ' + (Math.random() < 0.5 ? 'Heads' : 'Tails'));
});

client.login(token).catch(err => {
  console.error('Login error:', err);
  process.exit(1);
});
