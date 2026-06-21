import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("roll")
  .setDescription("Roll a random number between two values")
  .addIntegerOption((option) =>
    option
      .setName("min")
      .setDescription("Minimum value (inclusive)")
      .setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName("max")
      .setDescription("Maximum value (inclusive)")
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const min = interaction.options.getInteger("min", true);
  const max = interaction.options.getInteger("max", true);

  if (min >= max) {
    await interaction.reply({
      content: `❌ **min** must be less than **max**. You provided min=${min}, max=${max}.`,
      ephemeral: true,
    });
    return;
  }

  const result = Math.floor(Math.random() * (max - min + 1)) + min;

  await interaction.reply(
    `🎲 Rolling between **${min}** and **${max}**... you got **${result}**!`
  );
}
