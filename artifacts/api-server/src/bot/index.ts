import {Client,GatewayIntentBits,Message,REST,Routes} from "discord.js";
import {logger} from "../lib/logger.js";
import {execute as roll} from "./commands/roll.js";
import {execute as coinflip} from "./commands/coinflip.js";
import {execute as choose} from "./commands/choose.js";
import {execute as disable} from "./commands/disable.js";
import {execute as enable} from "./commands/enable.js";
import {execute as stfu} from "./commands/stfu.js";
import {execute as stats} from "./commands/stats.js";
import {execute as bully} from "./commands/bully.js";
import {execute as coinwar} from "./commands/coinwar.js";
import {execute as help} from "./commands/help.js";
import {execute as ship} from "./commands/ship.js";
import {execute as ignore} from "./commands/ignore.js";
import {execute as unignore} from "./commands/unignore.js";
import {execute as dicewar} from "./commands/dicewar.js";
import {execute as silence,isSilenced} from "./commands/silence.js";
import {disabledChannels,ignoredUsers} from "./channelState.js";

const PREFIX="-",CD=20000,OWNER=".luckyyy_";
const NO_CD=new Set(["d","cf"]);
const userCd=new Map();
const cmds=new Map([
["d",roll],["cf",coinflip],["choose",choose],
["disable",disable],["enable",enable],["stfu",stfu],
["stats",stats],["bully",bully],["cw",coinwar],
["help",help],["ship",ship],["ignore",ignore],
["unignore",unignore],["dw",dicewar],["silence",silence]
]);

async function clearSlash(t,c){try{const r=new REST({version:"10"}).setToken(t);await r.put(Routes.applicationCommands(c),{body:[]})}catch(e){logger.error({e})}}
function newClient(){return new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]})}

async function connect(t){let d=5000;for(;;){const c=newClient();c.once("ready",async cl=>{logger.info({tag:cl.user.tag});d=5000;await clearSlash(t,cl.user.id)});c.on("error",e=>logger.error({e}));c.on("messageCreate",async m=>{if(m.author.bot)return;
if(m.author.username===OWNER){const [cmd,...a]=m.content.slice(1).trim().split(/\s+/);const h=cmds.get(cmd?.toLowerCase());if(h)try{await h(m,a)}catch(e){}return}
const g=m.guild?.id;if(isSilenced(g)||ignoredUsers.has(m.author.id)||disabledChannels.has(m.channelId)||!m.content.startsWith(PREFIX))return;
const [cmd,...a]=m.content.slice(1).trim().split(/\s+/);const cl=cmd?.toLowerCase()||"";
if(!NO_CD.has(cl)){const n=Date.now(),l=userCd.get(m.author.id)||0;if(n-l<CD)return m.reply(`⏳ ${Math.ceil((CD-n+l)/1000)}s`).catch(()=>{});userCd.set(m.author.id,n)}
const h=cmds.get(cl);if(!h)return;try{await h(m,a)}catch(e){}});
try{await c.login(t);await new Promise(r=>c.once("disconnect",r))}catch(e){logger.error({e});await new Promise(r=>setTimeout(r,d));d=Math.min(d*2,60000)}finally{c.destroy()}}}

export async function startBot(){const t=process.env.DISCORD_BOT_TOKEN;if(!t)return;connect(t).catch(e=>logger.error({e}))}
