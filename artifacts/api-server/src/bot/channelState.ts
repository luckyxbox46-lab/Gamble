import fs from "fs";
import path from "path";
const pathFile=path.join(process.cwd(),"state.json");
function load(){try{return fs.existsSync(pathFile)?JSON.parse(fs.readFileSync(pathFile,"utf8")):{disabled:[],ignored:[]}}catch{return{disabled:[],ignored:[]}}}
function save(d:any){fs.writeFileSync(pathFile,JSON.stringify(d))}
const data=load();
export const disabledChannels=new Set<string>(data.disabled||[]);
export const ignoredUsers=new Set<string>(data.ignored||[]);
export function saveAll(){save({disabled:[...disabledChannels],ignored:[...ignoredUsers]})}
