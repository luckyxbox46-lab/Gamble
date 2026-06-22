import fs from "fs";
import path from "path";

const STATE_FILE = path.join(process.cwd(), "channel-state.json");

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      return {
        disabledChannels: new Set<string>(data.disabledChannels || []),
        ignoredUsers: new Set<string>(data.ignoredUsers || [])
      };
    }
  } catch {}
  return { disabledChannels: new Set<string>(), ignoredUsers: new Set<string>() };
}

function saveState(disabled: Set<string>, ignored: Set<string>) {
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({
      disabledChannels: Array.from(disabled),
      ignoredUsers: Array.from(ignored)
    })
  );
}

const initial = loadState();
export const disabledChannels = initial.disabledChannels;
export const ignoredUsers = initial.ignoredUsers;

export function toggleChannel(channelId: string, disable: boolean) {
  disable ? disabledChannels.add(channelId) : disabledChannels.delete(channelId);
  saveState(disabledChannels, ignoredUsers);
}

export function toggleUser(userId: string, ignore: boolean) {
  ignore ? ignoredUsers.add(userId) : ignoredUsers.delete(userId);
  saveState(disabledChannels, ignoredUsers);
}
