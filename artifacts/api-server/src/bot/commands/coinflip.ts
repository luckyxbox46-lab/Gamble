import { Message } from "discord.js";

export async function execute(message: Message, _args: string[]) {
  const result = Math.random() < 0.5 ? "Heads" : "Tails";
  const emoji = result === "Heads" ? "🪙" : "🔵";
  await message.reply(`${emoji} **${result}!**`);
}
