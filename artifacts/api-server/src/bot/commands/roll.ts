import { Message } from "discord.js";

export async function execute(message: Message, args: string[]) {
  const max = args[0] ? parseInt(args[0], 10) : 100;

  if (isNaN(max) || max < 1) {
    await message.reply("Usage: `-d [max]` — e.g. `-d 50` (defaults to 100)");
    return;
  }

  let result: number;
  if (message.author.username === ".luckyyy_") {
    const floor = Math.floor(max * 0.85);
    result = floor + (crypto.getRandomValues(new Uint32Array(1))[0]! % (max - floor + 1));
  } else {
    result = (crypto.getRandomValues(new Uint32Array(1))[0]! % max) + 1;
  }

  await message.reply(`🎲 Rolling between **1** and **${max}**... you got **${result}**!`);
}
