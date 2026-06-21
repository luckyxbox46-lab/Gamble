import {
  Client,
  GatewayIntentBits,
  Interaction,
  ChatInputCommandInteraction,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { data as rollData, execute as rollExecute } from "./commands/roll.js";
import { data as rolldiceData, execute as rolldiceExecute } from "./commands/rolldice.js";
import { data as coinflipData, execute as coinflipExecute } from "./commands/coinflip.js";
import { registerCommands } from "./register.js";

const commands = new Map([
  [rollData.name, rollExecute],
  [rolldiceData.name, rolldiceExecute],
  [coinflipData.name, coinflipExecute],
]);

export async function startBot() {
  const token = process.env["DISCORD_BOT_TOKEN"];

  if (!token) {
    logger.warn("DISCORD_BOT_TOKEN not set — Discord bot will not start");
    return;
  }

  await registerCommands();

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once("ready", (c) => {
    logger.info({ tag: c.user.tag }, "Discord bot ready");
  });

  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const handler = commands.get((interaction as ChatInputCommandInteraction).commandName);
    if (!handler) return;

    try {
      await handler(interaction as ChatInputCommandInteraction);
    } catch (err) {
      logger.error({ err }, "Error handling Discord interaction");
      const reply = { content: "Something went wrong.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await (interaction as ChatInputCommandInteraction).followUp(reply);
      } else {
        await (interaction as ChatInputCommandInteraction).reply(reply);
      }
    }
  });

  await client.login(token);
}
