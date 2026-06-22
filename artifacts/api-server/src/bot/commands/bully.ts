import { Message, PermissionFlagsBits } from "discord.js";

const PING_COUNT = 20;
const DELAY_MS = 500;

export async function execute(message: Message, _args: string[]) {
  const member = message.guild?.members.cache.get(message.author.id);
  const isAdmin = member?.permissions.has(PermissionFlagsBits.Administrator);

  if (!isAdmin) {
    await message.reply("❌ Admins only.");
    return;
  }

  const target = message.mentions.users.first();
  if (!target) {
    await message.reply("Usage: `-bully @user`");
    return;
  }

  for (let i = 0; i < PING_COUNT; i++) {
    await message.channel.send(`${target}`);
    await new Promise((res) => setTimeout(res, DELAY_MS));
  }
}
