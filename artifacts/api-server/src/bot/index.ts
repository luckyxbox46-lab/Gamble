import { Client, GatewayIntentBits, Message } from "discord.js";

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("ERROR: DISCORD_BOTTOKEN environment variable not set");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = "-";
const OWNER = ".luckyyy";

client.once("ready", () => {
  console.log("Bot online: " + client.user?.tag);
});

client.on("messageCreate", async (msg: Message) => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const input = msg.content.slice(PREFIX.length).trim().toLowerCase();
  if (!input) return;

  if (input === "help") {
    return msg.reply("Commands:\n-d = Roll dice\n-cf = Flip coin\n-help = Show this list");
  }
  if (input === "d") {
    const roll = Math.floor(Math.random() * 100) + 1;
    return msg.reply("Roll: " + roll);
  }
  if (input === "cf") {
    const flip = Math.random() < 0.5 ? "Heads" : "Tails";
    return msg.reply("Coinflip: " + flip);
  }
});

client.login(token).catch(err => {
  console.error("Login failed:", err);
  process.exit(1);
});
