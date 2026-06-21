import { REST, Routes } from "discord.js";
import { data as rollCommand } from "./commands/roll.js";
import { data as rolldiceCommand } from "./commands/rolldice.js";
import { data as coinflipCommand } from "./commands/coinflip.js";
import { logger } from "../lib/logger.js";

export async function registerCommands() {
  const token = process.env["DISCORD_BOT_TOKEN"];
  const clientId = process.env["DISCORD_CLIENT_ID"];

  if (!token || !clientId) {
    logger.error(
      "DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID must be set to register commands"
    );
    return;
  }

  const commands = [rollCommand.toJSON(), rolldiceCommand.toJSON(), coinflipCommand.toJSON()];

  const rest = new REST().setToken(token);

  try {
    logger.info("Registering Discord slash commands...");
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    logger.info("Discord slash commands registered successfully");
  } catch (err) {
    logger.error({ err }, "Failed to register Discord slash commands");
  }
}
