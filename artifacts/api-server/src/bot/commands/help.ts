import { Message } from "discord.js";

export async function execute(message: Message) {
  await message.reply(`
📖 **Bot Commands**
• 🎲 **-d [max]** — Roll 1 to max (default 100)
• 🪙 **-cf** — Flip a coin
• 🎯 **-choose opt1 opt2 ...** — Pick one randomly
• ⚔️ **-dw @user rounds sides** — Dice War battle
• 🪙 **-cw @user heads/tails** — Coin War battle
• 💞 **-ship @user1 @user2** — Compatibility rating 1–10
• 📊 **-stats** — Show rolls, flips, uptime
• 🔇 **-silence** — Toggle bot quiet (owner only)

👑 **Admin Only**
• ❌ **-disable** — Stop commands in this channel
• ✅ **-enable** — Re-enable commands
• 👊 **-bully @user** — Spam ping someone
  `);
}
