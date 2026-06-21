import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";

const DICE_FACES = [4, 6, 8, 10, 12, 20, 100] as const;
type DieFace = (typeof DICE_FACES)[number];

const DICE_EMOJI: Record<DieFace, string> = {
  4:   "🔺",
  6:   "🎲",
  8:   "💎",
  10:  "🔟",
  12:  "🔷",
  20:  "⚔️",
  100: "💯",
};

export const data = new SlashCommandBuilder()
  .setName("rolldice")
  .setDescription("Roll one or more standard RPG dice")
  .addIntegerOption((option) =>
    option
      .setName("sides")
      .setDescription("Type of die to roll (d4, d6, d8, d10, d12, d20, d100)")
      .setRequired(true)
      .addChoices(
        { name: "d4",   value: 4   },
        { name: "d6",   value: 6   },
        { name: "d8",   value: 8   },
        { name: "d10",  value: 10  },
        { name: "d12",  value: 12  },
        { name: "d20",  value: 20  },
        { name: "d100", value: 100 }
      )
  )
  .addIntegerOption((option) =>
    option
      .setName("count")
      .setDescription("How many dice to roll (1–20, default 1)")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(20)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sides = interaction.options.getInteger("sides", true) as DieFace;
  const count = interaction.options.getInteger("count") ?? 1;

  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }

  const total = rolls.reduce((sum, n) => sum + n, 0);
  const emoji = DICE_EMOJI[sides];
  const diceLabel = `${count}d${sides}`;

  let response: string;
  if (count === 1) {
    response = `${emoji} **${diceLabel}** → **${rolls[0]}**`;
  } else {
    const rollList = rolls.join(", ");
    response = `${emoji} **${diceLabel}** → [${rollList}] = **${total}**`;
  }

  await interaction.reply(response);
}
