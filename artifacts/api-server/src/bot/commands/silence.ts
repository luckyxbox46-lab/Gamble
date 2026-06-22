import { Message } from "discord.js";

let silenced = false;

export function isSilenced() {
  return silenced;
}

export async function execute(message: Message, _args: string[]) {
  if (message.author.username !== ".luckyyy_") {
    return;
  }

  silenced = !silenced;

  if (silenced) {
    await message.reply("🔇 I'll be quiet.");
  } else {
    await message.reply("🔊 I'm back!");
  }
}

