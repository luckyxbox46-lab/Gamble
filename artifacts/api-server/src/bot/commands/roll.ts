import { Message } from "discord.js";

export async function execute(message: Message, args: string[]) {
  const max = parseInt(args[0] ?? "", 10);

  if (isNaN(max) || max < 1) {
    await message.reply("Usage: `-roll <max>` — e.g. `-roll 100`");
    return;
  }

  const result = (crypto.getRandomValues(new Uint32Array(1))[0]! % max) + 1;
  await message.reply(`🎲 Rolling between **1** and **${max}**... you got **${result}**!`);
}
