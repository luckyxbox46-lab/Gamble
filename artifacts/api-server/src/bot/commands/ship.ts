import { Message } from "discord.js";

const facts: Record<string, string[]> = {
  low: [
    "They'd probably argue about everything.",
    "They're better off as strangers.",
    "The vibes are completely off. Not happening.",
    "This ship sank before it even left the harbour.",
    "The universe itself is against this one.",
  ],
  mid: [
    "Maybe after a few drinks.",
    "They could be friends... at best.",
    "There's a tiny spark, but it might just be static.",
    "Possible, but they'd need to work on it.",
    "Not the worst ship, not the best. Very mid energy.",
  ],
  high: [
    "There's genuine chemistry here. Could be something.",
    "A solid match. They'd balance each other out well.",
    "Pretty compatible! Ship it.",
    "Good energy between them. This could actually work.",
    "Strong connection. They probably already know it too.",
  ],
  perfect: [
    "Soulmates. It's practically written in the stars.",
    "Absolutely meant to be. Don't fight it.",
    "100% certified power couple. No further questions.",
    "The chemistry is off the charts. Unreal.",
    "This is the ship of the century. Historic.",
  ],
};

function hashNames(a: string, b: string): number {
  const key = [a, b].sort().join("|").toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickFrom<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
}

export async function execute(message: Message, args: string[]) {
  const mentions = message.mentions.users;

  let name1: string;
  let name2: string;

  if (mentions.size >= 2) {
    const [u1, u2] = [...mentions.values()];
    name1 = u1!.displayName ?? u1!.username;
    name2 = u2!.displayName ?? u2!.username;
  } else if (mentions.size === 1) {
    const [u1] = [...mentions.values()];
    name1 = u1!.displayName ?? u1!.username;
    name2 = args.find((a) => !a.startsWith("<@")) ?? "";
    if (!name2) {
      await message.reply("Usage: `-ship @user1 @user2` or `-ship name1 name2`");
      return;
    }
  } else if (args.length >= 2) {
    name1 = args[0]!;
    name2 = args[1]!;
  } else {
    await message.reply("Usage: `-ship @user1 @user2` or `-ship name1 name2`");
    return;
  }

  const hash = hashNames(name1, name2);
  const rating = (hash % 10) + 1;

  let tier: keyof typeof facts;
  let bar: string;
  if (rating <= 3) {
    tier = "low";
    bar = "❤️".repeat(rating) + "🖤".repeat(10 - rating);
  } else if (rating <= 6) {
    tier = "mid";
    bar = "❤️".repeat(rating) + "🖤".repeat(10 - rating);
  } else if (rating <= 9) {
    tier = "high";
    bar = "❤️".repeat(rating) + "🖤".repeat(10 - rating);
  } else {
    tier = "perfect";
    bar = "❤️".repeat(10);
  }

  const fact = pickFrom(facts[tier], hash >> 4);
  const shipName = name1.slice(0, Math.ceil(name1.length / 2)) + name2.slice(Math.floor(name2.length / 2));

  await message.reply(
    `💘 **${name1}** + **${name2}** = **${shipName}**\n` +
    `${bar}\n` +
    `**${rating}/10** — ${fact}`
  );
}
