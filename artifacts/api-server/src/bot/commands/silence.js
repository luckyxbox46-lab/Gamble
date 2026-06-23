import fs from "fs";
import path from "path";
const f=path.join(process.cwd(),"silence.json");
const OWNER=".luckyyy_";
function load(){try{return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,"utf8")):{}}catch{return{}}}
function save(d){fs.writeFileSync(f,JSON.stringify(d))}
export async function execute(m){if(m.author.username!==OWNER)return m.reply("❌ Owner only").catch(()=>{});const g=m.guild?.id;if(!g)return m.reply("⚠️ Only in server").catch(()=>{});const s=load();s[g]=!s[g];save(s);return m.reply(s[g]?"🔇 Bot silenced":"🔊 Bot active").catch(()=>{});}
export function isSilenced(g){return !!load()[g]}
