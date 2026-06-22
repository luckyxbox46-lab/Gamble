import { Message } from "discord.js";

const DELAY_MS = 800;

function roll(max: number): number {
  return (crypto.getRandomValues(new Uint32Array(1))[0]! % max) + 1;
}

export async function execute(message: Message, args: string[]) {
  const target = message.mentions.users.first();
  const rounds = parseInt(args[1] ?? "");
  const sides = parseInt(args[2] ?? "");

  if (!target || isNaN(rounds) || isNaN(sides) || rounds < 1 || sides < 2) {
    await message.reply("Usage: `-dw @user (rounds) (dice size)` e.g. `-dw @user 3 6`");
    return;
  }

  if (target.id === message.author.id) {
    await message.reply("You can't dice war yourself.");
    return;
  }

  if (target.bot) {
    await message.reply("You can't war against a bot.");
    return;
  }

  await message.channel.send(
    `🎲 **Dice War!**\n` +
    `${message.author} vs ${target}\n` +
    `**${rounds} rounds** — rolling a **d${sides}**\n\n` +
    `Rolling...`
  );

  let challengerWins = 0;
  let targetWins = 0;

  for (let round = 1; round <= rounds; round++) {
    await new Promise((res) => setTimeout(res, DELAY_MS));
    const challengerRoll = roll(sides);
    const targetRoll = roll(sides);
    if (challengerRoll > targetRoll) {
      challengerWins++;
      await message.channel.send(`Round ${round}: 🎲 **${challengerRoll}** vs 🎲 ${targetRoll} — **${message.author.username} takes the round!**`);
    } else if (targetRoll > challengerRoll) {
      targetWins++;
      await message.channel.send(`Round ${round}: 🎲 ${challengerRoll} vs 🎲 **${targetRoll}** — **${target.username} takes the round!**`);
    } else {
      await message.channel.send(`Round ${round}: 🎲 ${challengerRoll} vs 🎲 ${targetRoll} — **Tie! No point awarded.**`);
    }
  }

  await new Promise((res) => setTimeout(res, DELAY_MS));

  if (challengerWins > targetWins) {
    await message.channel.send(`🏆 **${message.author.username} wins the Dice War ${challengerWins}-${targetWins}!** ${target} L + ratio`);
  } else if (targetWins > challengerWins) {
    await message.channel.send(`🏆 **${target.username} wins the Dice War ${targetWins}-${challengerWins}!** ${message.author} L + ratio`);
  } else {
    await message.channel.send(`🤝 **It's a draw! ${challengerWins}-${targetWins}** — no L's today.`);
  }
}
