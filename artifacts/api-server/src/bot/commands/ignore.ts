import { Message } from "discord.js";
import { ignoredUsers } from "../channelState.js";

const OWNER = ".luckyyy_";

export async function execute(message: Message, _args: string[]) {
  if (message.author.username !== OWNER) return;

  const target = message.mentions.users.first();
  if (!target) {
    await message.reply("Usage: `-ignore @user`");
    return;
  }

  if (target.id === message.author.id) {
    await message.reply("You can't ignore yourself.");
    return;
  }

  ignoredUsers.add(target.id);
  await message.reply(`🔇 I'll stop listening to **${target.username}**.`);
}
