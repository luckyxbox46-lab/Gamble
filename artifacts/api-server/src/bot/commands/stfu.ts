import { Message } from "discord.js";

export async function execute(message: Message, _args: string[]) {
  const target = message.mentions.users.first();

  if (!target) {
    await message.reply("Usage: `-stfu @user`");
    return;
  }

  await message.channel.send(`<@${target.id}> SHUT UP!`);
}
