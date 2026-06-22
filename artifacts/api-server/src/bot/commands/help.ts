import { Message } from "discord.js";

export async function execute(message: Message, _args: string[]) {
  await message.reply(
    `📖 **Bot Commands** (prefix: \`-\`)\n\n` +
    `🎲 \`-d [max]\` — Roll a number from 1 to max (default 100)\n` +
    `🪙 \`-cf\` — Flip a coin\n` +
    `🎯 \`-choose option1 option2 ...\` — Pick randomly from your options\n` +
    `⚔️ \`-coinwar @user heads/tails\` — Coin flip battle, pick your side\n` +
    `📊 \`-stats\` — Show session stats (rolls, flips, chooses, uptime)\n` +
    `🔇 \`-stfu @user\` — Tell someone to shut up\n\n` +
    `**Admin only:**\n` +
    `🚫 \`-disable\` — Disable bot commands in this channel\n` +
    `✅ \`-enable\` — Re-enable bot commands in this channel\n` +
    `👊 \`-bully @user\` — Ping someone 20 times in a row`
  );
}
