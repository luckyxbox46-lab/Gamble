import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("coinflip")
  .setDescription("Flip a coin — heads or tails");

export async function execute(interaction: ChatInputCommandInteraction) {
  const result = Math.random() < 0.5 ? "Heads" : "Tails";
  const emoji = result === "Heads" ? "🪙" : "🔵";
  await interaction.reply(`${emoji} **${result}!**`);
}
