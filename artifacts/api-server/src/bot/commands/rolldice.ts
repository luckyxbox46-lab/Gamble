import { Message } from "discord.js";

const VALID_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
type DieFace = (typeof VALID_SIDES)[number];

const DICE_EMOJI: Record<DieFace, string> = {
  4:   "🔺",
  6:   "🎲",
  8:   "💎",
  10:  "🔟",
  12:  "🔷",
  20:  "⚔️",
  100: "💯",
};

export async function execute(message: Message, args: string[]) {
  const raw = (args[0] ?? "").toLowerCase().replace("d", "");
  const sides = parseInt(raw, 10) as DieFace;
  const count = args[1] ? parseInt(args[1], 10) : 1;

  if (!VALID_SIDES.includes(sides as DieFace)) {
    await message.reply(
      `Usage: \`-rolldice <sides> [count]\` — sides must be one of: ${VALID_SIDES.map((s) => `d${s}`).join(", ")}\nExample: \`-rolldice d20 3\``
    );
    return;
  }

  if (isNaN(count) || count < 1 || count > 20) {
    await message.reply("Count must be a number between 1 and 20.");
    return;
  }

  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides));
  }

  const total = rolls.reduce((sum, n) => sum + n, 0);
  const emoji = DICE_EMOJI[sides];
  const diceLabel = `${count}d${sides}`;

  let response: string;
  if (count === 1) {
    response = `${emoji} **${diceLabel}** → **${rolls[0]}**`;
  } else {
    response = `${emoji} **${diceLabel}** → [${rolls.join(", ")}] = **${total}**`;
  }

  await message.reply(response);
}
