import { Message, PermissionFlagsBits } from "discord.js";
import { disabledChannels } from "../channelState.js";

export async function execute(message: Message, _args: string[]) {
  const member = message.member;
  if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Only administrators can use this command.").catch(() => undefined);
    return;
  }

  const targetId = message.mentions.channels.first()?.id ?? message.channelId;
  const channelName = message.mentions.channels.first()
    ? `<#${targetId}>`
    : "this channel";

  if (!disabledChannels.has(targetId)) {
    await message.reply(`⚠️ The bot is not disabled in ${channelName}.`);
    return;
  }

  disabledChannels.delete(targetId);
  await message.reply(`🔊 Bot commands re-enabled in ${channelName}.`);
}
