import fs from "fs";
import path from "path";

const STATEFILE = path.join(process.cwd(), "silence-state.json");
const OWNER = ".luckyyy";

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {}
  return {};
}

function saveState(data) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
}

export async function execute(message) {
  if (message.author.username !== OWNER) {
    return message.reply("❌ Only the owner can use this command.").catch(() => {});
  }

  const guildId = message.guild?.id;
  if (!guildId) return message.reply("⚠️ This command only works inside servers.").catch(() => {});

  const state = loadState();
  state[guildId] = !state[guildId];
  saveState(state);

  return message.reply(state[guildId] ? "🔇 Bot silenced only in this server." : "🔊 Bot unsilenced for this server.").catch(() => {});
}

export function isSilenced(guildId) {
  const state = loadState();
  return !!state[guildId];
}
