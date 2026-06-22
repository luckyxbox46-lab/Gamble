import { Message } from "discord.js";

const DELAY_MS = 800;

function flip(): "Heads" | "Tails" {
  return crypto.getRandomValues(new Uint8Array(1))[0]! % 2 === 0 ? "Heads" : "Tails";
}

export async function execute(message: Message, args: string[]) {
  const target = message.mentions.users.first();
  const sideArg = args.find((a) => /^(heads|tails)$/i.test(a))?.toLowerCase();

  if (!target || !sideArg) {
    await message.reply("Usage: `-coinwar @user heads` or `-coinwar @user tails`");
    return;
  }

  if (target.id === message.author.id) {
    await message.reply("You can't coinwar yourself.");
    return;
  }

  if (target.bot) {
    await message.reply("You can't war against a bot.");
    return;
  }

  const challengerSide = sideArg === "heads" ? "Heads" : "Tails";
  const targetSide = challengerSide === "Heads" ? "Tails" : "Heads";

  await message.channel.send(
    `⚔️ **Coin War!**\n` +
    `${message.author} is betting on **${challengerSide}**\n` +
    `${target} is betting on **${targetSide}**\n\n` +
    `Flipping...`
  );

  let round = 1;

  while (true) {
    await new Promise((res) => setTimeout(res, DELAY_MS));

    const challengerFlip = flip();
    const targetFlip = flip();

    const c1 = challengerFlip === "Heads" ? "🪙" : "🔵";
    const c2 = targetFlip === "Heads" ? "🪙" : "🔵";

    const challengerWon = challengerFlip === challengerSide;
    const targetWon = targetFlip === targetSide;

    if (challengerWon && targetWon) {
      await message.channel.send(
        `Round ${round}: ${c1} ${challengerFlip} vs ${c2} ${targetFlip} — **Both hit! No winner, flipping again...**`
      );
    } else if (challengerWon) {
      await message.channel.send(
        `Round ${round}: ${c1} **${challengerFlip}** vs ${c2} ${targetFlip}\n\n` +
        `🏆 **${message.author.username} wins the coin war!** ${target} L + ratio`
      );
      break;
    } else if (targetWon) {
      await message.channel.send(
        `Round ${round}: ${c1} ${challengerFlip} vs ${c2} **${targetFlip}**\n\n` +
        `🏆 **${target.username} wins the coin war!** ${message.author} L + ratio`
      );
      break;
    } else {
      await message.channel.send(
        `Round ${round}: ${c1} ${challengerFlip} vs ${c2} ${targetFlip} — neither hit, flipping again...`
      );
    }

    round++;
  }
}
