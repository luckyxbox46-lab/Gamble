import { Message } from "discord.js";

export async function execute(message: Message, _args: string[]) {
  const result = crypto.getRandomValues(new Uint8Array(1))[0]! % 2 === 0 ? "Heads" : "Tails";
  const emoji = result === "Heads" ? "🪙" : "🔵";
  await message.reply(`${emoji} **${result}!**`);
}
