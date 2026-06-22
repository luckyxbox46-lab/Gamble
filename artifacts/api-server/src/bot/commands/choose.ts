import { Message } from "discord.js";
import { stats } from "../stats.js";

export async function execute(message: Message, args: string[]) {
  if (args.length < 2) {
    await message.reply("Usage: `-choose option1 option2 option3 ...` — provide at least 2 options");
    return;
  }

  stats.chooses++;
  const index = crypto.getRandomValues(new Uint32Array(1))[0]! % args.length;
  const chosen = args[index];

  await message.reply(`🎯 I choose... **${chosen}**!`);
}
