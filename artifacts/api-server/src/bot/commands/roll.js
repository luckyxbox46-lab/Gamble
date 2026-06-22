export async function execute(message, args) {
  const max = parseInt(args[0]) || 100;
  const result = Math.floor(Math.random() * max) + 1;
  if (result === 67) {
    await message.reply(`🎲 Roll: 67\n\n67\n67\n67\n67\n67\n67\n67\n67\n67\n67`);
  } else {
    await message.reply(`🎲 Roll: ${result}`);
  }
}
