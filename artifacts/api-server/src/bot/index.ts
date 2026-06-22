import {
  Client,
  GatewayIntentBits,
  Message,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { execute as rollExecute } from "./commands/roll.js";
import { execute as coinflipExecute } from "./commands/coinflip.js";
import { execute as chooseExecute } from "./commands/choose.js";
import { execute as disableExecute } from "./commands/disable.js";
import { execute as enableExecute } from "./commands/enable.js";
import { execute as stfuExecute } from "./commands/stfu.js";
import { execute as statsExecute } from "./commands/stats.js";
import { execute as bullyExecute } from "./commands/bully.js";
import { disabledChannels } from "./channelState.js";

const PREFIX = "-";
const RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 60_000;

type CommandHandler = (msg: Message, args: string[]) => Promise<void>;

const commands = new Map<string, CommandHandler>([
  ["d", rollExecute],
  ["cf", coinflipExecute],
  ["choose", chooseExecute],
  ["disable", disableExecute],
  ["enable", enableExecute],
  ["stfu", stfuExecute],
  ["stats", statsExecute],
  ["bully", bullyExecute],
]);

function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
}

async function connectWithRetry(token: string) {
  let delay = RECONNECT_DELAY_MS;

  while (true) {
    const client = createClient();

    client.once("clientReady", (c) => {
      logger.info({ tag: c.user.tag }, "Discord bot ready");
      delay = RECONNECT_DELAY_MS;
    });

    client.on("error", (err) => {
      logger.error({ err }, "Discord client error");
    });

    client.on("warn", (info) => {
      logger.warn({ info }, "Discord client warning");
    });

    client.on("messageCreate", async (message: Message) => {
      if (message.author.bot) return;
      if (!message.content.startsWith(PREFIX)) return;

      const [rawCommand, ...args] = message.content
        .slice(PREFIX.length)
        .trim()
        .split(/\s+/);
      const commandName = rawCommand?.toLowerCase();
      if (!commandName) return;

      const handler = commands.get(commandName);
      if (!handler) return;

      const adminOnlyCommands = new Set(["disable", "enable"]);
      if (disabledChannels.has(message.channelId) && !adminOnlyCommands.has(commandName)) return;

      try {
        await handler(message, args);
      } catch (err) {
        logger.error({ err }, "Error handling Discord command");
        await message.reply("Something went wrong.").catch(() => undefined);
      }
    });

    try {
      await client.login(token);

      await new Promise<void>((resolve) => {
        client.once("shardDisconnect" as Parameters<typeof client.once>[0], resolve);
      });

      logger.warn("Discord connection closed — reconnecting...");
    } catch (err) {
      logger.error({ err, retryInMs: delay }, "Discord login failed — retrying");
    } finally {
      client.destroy();
    }

    await new Promise((res) => setTimeout(res, delay));
    delay = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
  }
}

export async function startBot() {
  const token = process.env["DISCORD_BOT_TOKEN"];

  if (!token) {
    logger.warn("DISCORD_BOT_TOKEN not set — Discord bot will not start");
    return;
  }

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled promise rejection — bot staying up");
  });

  process.on("uncaughtException", (err) => {
    logger.error({ err }, "Uncaught exception — bot staying up");
  });

  connectWithRetry(token).catch((err) => {
    logger.error({ err }, "Fatal error in reconnect loop");
  });
}
