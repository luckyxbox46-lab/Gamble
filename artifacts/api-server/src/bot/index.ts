import {
  Client,
  GatewayIntentBits,
  Message,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { execute as rollExecute } from "./commands/roll.js";
import { execute as coinflipExecute } from "./commands/coinflip.js";
import { execute as chooseExecute } from "./commands/choose.js";

const PREFIX = "-";

type CommandHandler = (msg: Message, args: string[]) => Promise<void>;

const commands = new Map<string, CommandHandler>([
  ["d", rollExecute],
  ["cf", coinflipExecute],
  ["choose", chooseExecute],
]);

export async function startBot() {
  const token = process.env["DISCORD_BOT_TOKEN"];

  if (!token) {
    logger.warn("DISCORD_BOT_TOKEN not set — Discord bot will not start");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once("clientReady", (c) => {
    logger.info({ tag: c.user.tag }, "Discord bot ready");
  });

  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const [rawCommand, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const commandName = rawCommand?.toLowerCase();
    if (!commandName) return;

    const handler = commands.get(commandName);
    if (!handler) return;

    try {
      await handler(message, args);
    } catch (err) {
      logger.error({ err }, "Error handling Discord command");
      await message.reply("Something went wrong.").catch(() => undefined);
    }
  });

  await client.login(token);
}
