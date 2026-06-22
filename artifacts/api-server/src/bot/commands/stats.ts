import { Message } from "discord.js";
import { stats } from "../stats.js";

export async function execute(message: Message, _args: string[]) {
  const uptimeMs = Date.now() - stats.startedAt.getTime();
  const hours = Math.floor(uptimeMs / 3_600_000);
  const minutes = Math.floor((uptimeMs % 3_600_000) / 60_000);

  await message.reply(
    `📊 **Session Stats**\n` +
    `🎲 Rolls: **${stats.rolls}**\n` +
    `🪙 Coin flips: **${stats.flips}**\n` +
    `🎯 Chooses: **${stats.chooses}**\n` +
    `⏱️ Uptime: **${hours}h ${minutes}m**`
  );
}
