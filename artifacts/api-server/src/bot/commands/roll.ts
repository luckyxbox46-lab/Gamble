import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("roll")
  .setDescription("Roll a random number from 0 up to a maximum value")
  .addIntegerOption((option) =>
    option
      .setName("max")
      .setDescription("Maximum value (inclusive)")
      .setRequired(true)
      .setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const max = interaction.options.getInteger("max", true);
  const result = Math.floor(Math.random() * (max + 1));

  await interaction.reply(
    `🎲 Rolling between **0** and **${max}**... you got **${result}**!`
  );
}
