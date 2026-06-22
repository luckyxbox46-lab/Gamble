import {Client,GatewayIntentBits,Message,REST,Routes} from "discord.js";
import {logger} from "../lib/logger.js";
import {execute as rollExecute} from "./commands/roll.js";
import {execute as coinflipExecute} from "./commands/coinflip.js";
import {execute as chooseExecute} from "./commands/choose.js";
import {execute as disableExecute} from "./commands/disable.js";
import {execute as enableExecute} from "./commands/enable.js";
import {execute as stfuExecute} from "./commands/stfu.js";
import {execute as statsExecute} from "./commands/stats.js";
import {execute as bullyExecute} from "./commands/bully.js";
import {execute as coinwarExecute} from "./commands/coinwar.js";
import {execute as helpExecute} from "./commands/help.js";
import {execute as shipExecute} from "./commands/ship.js";
import {execute as ignoreExecute} from "./commands/ignore.js";
import {execute as unignoreExecute} from "./commands/unignore.js";
import {execute as dicewarExecute} from "./commands/dicewar.js";
import {execute as silenceExecute,isSilenced} from "./commands/silence.js";
import {disabledChannels,ignoredUsers} from "./channelState.js";

const PREFIX="-",RECONNECT_DELAY_MS=5000,MAX_RECONNECT_DELAY_MS=60000;
const userCd=new Map(),CD=30000,OWNER=".luckyyy_";
type CommandHandler=(m:Message,a:string[])=>Promise<void>;

const commands=new Map<string,CommandHandler>([
["d",rollExecute],["cf",coinflipExecute],["choose",chooseExecute],
["disable",disableExecute],["enable",enableExecute],["stfu",stfuExecute],
["stats",statsExecute],["bully",bullyExecute],["cw",coinwarExecute],
["help",helpExecute],["ship",shipExecute],["ignore",ignoreExecute],
["unignore",unignoreExecute],["dw",dicewarExecute],["silence",silenceExecute]
]);

async function clearSlash(t:string,c:string){try{const r=new REST({version:"10"}).setToken(t);await r.put(Routes.applicationCommands(c),{body:[]})}catch(e){logger.error({e},"clear slash err")}}
function createClient(){return new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]})}

async function connectLoop(t:string){let d=RECONNECT_DELAY_MS;for(;;){const c=createClient();c.once("clientReady",async cl=>{logger.info({tag:cl.user.tag},"bot ready");d=RECONNECT_DELAY_MS;await clearSlash(t,cl.user.id)});c.on("error",e=>logger.error({e},"client err"));c.on("warn",i=>logger.warn({i},"warn"));c.on("messageCreate",async m=>{if(m.author.bot)return;if(isSilenced()&&m.author.username!==OWNER)return;if(ignoredUsers.has(m.author.id))return;if(!m.content.startsWith(PREFIX))return;if(m.author.username!==OWNER){const n=Date.now(),l=userCd.get(m.author.id)||0;if(n-l<CD){const w=Math.ceil((CD-(n-l))/1000);return m.reply(`⏳ Wait ${w}s`).catch(()=>{})}userCd.set(m.author.id,n)}const [cmd,...args]=m.content.slice(PREFIX.length).trim().split(/\s+/).filter(Boolean);const h=commands.get(cmd?.toLowerCase()||"");if(!h)return;if(disabledChannels.has(m.channelId)&&!["disable","enable"].includes(cmd||""))return;try{await h(m,args)}catch(e){logger.error({e},"cmd err");m.reply("Something went wrong.").catch(()=>{})}});try{await c.login(t);await new Promise(r=>c.once("shardDisconnect",r));logger.warn("reconnecting...")}catch(e){logger.error({e,wait:d},"login failed")}finally{c.destroy()}await new Promise(r=>setTimeout(r,d));d=Math.min(d*2,MAX_RECONNECT_DELAY_MS)}}

export async function startBot(){const t=process.env.DISCORD_BOT_TOKEN;if(!t)return logger.warn("No token");process.on("unhandledRejection",r=>logger.error({r},"unhandled rejection"));process.on("uncaughtException",e=>logger.error({e},"uncaught exception"));connectLoop(t).catch(e=>logger.error({e},"fatal"))}
