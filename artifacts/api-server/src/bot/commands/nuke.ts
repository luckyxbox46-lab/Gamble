import { Message } from "discord.js";

export async function execute(message: Message, _args: string[]) {
  if (!message.member?.permissions.has("Administrator")) {
    return;
  }

  const target = message.mentions.users.first();

  if (!target) {
    await message.reply("Usage: `-nuke @user`");
    return;
  }

  const fakeIp = `${rand(255)}.${rand(255)}.${rand(255)}.${rand(255)}`;
  const fakeMac = [...Array(6)].map(() => rand(255).toString(16).padStart(2, "0")).join(":");
  const cities = ["Chicago, IL, USA", "Houston, TX, USA", "London, UK", "Paris, France", "Tokyo, Japan", "Sydney, Australia", "Berlin, Germany", "Toronto, Canada", "Dubai, UAE", "Moscow, Russia", "Seoul, South Korea", "Mumbai, India", "São Paulo, Brazil", "Mexico City, Mexico", "Amsterdam, Netherlands", "Singapore", "Madrid, Spain", "Stockholm, Sweden", "Cape Town, South Africa", "Shanghai, China"];
  const isps = ["Comcast", "AT&T", "Verizon", "BT Group", "Orange", "NTT Communications", "Telstra", "Deutsche Telekom", "Rogers", "Etisalat", "Rostelecom", "KT Corporation", "Jio", "Claro", "Telmex", "KPN", "Singtel", "Telefonica", "Telia", "MTN", "China Telecom", "Starlink", "Google Fiber", "T-Mobile", "Spectrum"];
  const devices = ["Windows 11 PC", "MacBook Pro", "iPhone 15", "Samsung Galaxy S24", "Windows 10 Laptop", "iPad Pro", "Android Tablet", "Linux Desktop", "Chromebook"];
  const city = cities[rand(cities.length - 1)];
  const isp = isps[rand(isps.length - 1)];
  const device = devices[rand(devices.length - 1)];

  await message.channel.send(`☢️ **NUKE LAUNCHED** ☢️\n**Target:** ${target}\n\n🔍 **Locating target...**`);
  await delay(1500);
  await message.channel.send(`📡 **Target located.**\n> IP Address: \`${fakeIp}\`\n> MAC Address: \`${fakeMac}\`\n> Location: \`${city}\`\n> ISP: \`${isp}\`\n> Device: \`${device}\``);
  await delay(1500);
  await message.channel.send(`💣 **Nuke incoming...**\n█ [▓░░░░░░░░░] 10%`);
  await delay(800);
  await message.channel.send(`███ [▓▓▓░░░░░░░] 30%`);
  await delay(800);
  await message.channel.send(`█████ [▓▓▓▓▓░░░░░] 50%`);
  await delay(800);
  await message.channel.send(`███████ [▓▓▓▓▓▓▓░░░] 70%`);
  await delay(800);
  await message.channel.send(`█████████ [▓▓▓▓▓▓▓▓▓░] 90%`);
  await delay(800);
  await message.channel.send(`💥 **BOOM!** 💥\n${target} has been **OBLITERATED**.\nTheir IP has been **banned**, device **wiped**, and router **fried**. 🔥\n\n☢️ *This message will self-destruct in 3... 2... 1...*`);
}

function rand(max: number): number {
  return Math.floor(Math.random() * (max + 1));
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

