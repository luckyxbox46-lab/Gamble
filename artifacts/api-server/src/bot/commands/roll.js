export async function execute(message, args) {
  const max = parseInt(args[0]) || 100;
  // Make 67 more likely: 25% chance to hit 67 when max is 100
  const chance = Math.random();
  const result = (max === 100 && chance < 0.25) 
    ? 67 
    : Math.floor(Math.random() * max) + 1;

  if (result === 67) {
    await message.reply(`🎲 Roll: **67**\n\n67\n67\n67\n67\n67\n67\n67\n67\n67\n67\n\nhttps://tenor.com/view/bosnov-67-bosnov-67-67-meme-gif-16727368109953357722`);
  } else {
    await message.reply(`🎲 Roll: ${result}`);
  }
}
