import { Message } from "discord.js";
import { ignoredUsers } from "../channelState.js";

const OWNER = ".luckyyy_";

export async function execute(message: Message, _args: string[]) {
  if (message.author.username !== OWNER) return;

  const target = message.mentions.users.first();
  if (!target) {
    await message.reply("Usage: `-unignore @user`");
    return;
  }

  ignoredUsers.delete(target.id);
  await message.reply(`✅ I'll listen to **${target.username}** again.`);
}
