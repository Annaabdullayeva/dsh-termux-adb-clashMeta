import dgram from 'node:dgram'
import {randomInt} from 'node:crypto'
import {networkInterfaces} from 'node:os'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {readFile} from 'node:fs/promises'
import {setTimeout as delay} from 'node:timers/promises'

const exec = promisify(execFile)
const adbPath = '/data/data/com.termux/files/usr/bin/adb'
const pkg = 'com.github.metacubex.clash.meta'
const component = `${pkg}/com.github.kr328.clash.ExternalControlActivity`
const service = '_adb-tls-connect._tcp.local'
const group = '224.0.0.251'
const bootIdPath = '/proc/sys/kernel/random/boot_id'
const wifiAddresses = () => Object.entries(networkInterfaces()).filter(([nic]) => /^wlan\d+$/.test(nic)).flatMap(([, entries]) => entries.filter(e => e.family === 'IPv4' && !e.internal).map(e => e.address)).slice(0,4)

function question(id, name, type) {
  const header = Buffer.alloc(12); header.writeUInt16BE(id); header.writeUInt16BE(1,4)
  const trailer = Buffer.alloc(5); trailer.writeUInt16BE(type,1); trailer.writeUInt16BE(1,3)
  return Buffer.concat([header,...name.split('.').map(s => Buffer.concat([Buffer.from([s.length]),Buffer.from(s,'ascii')])),trailer])
}
// DNS names may point to earlier labels in the same packet. Bound pointer work
// and reject malformed/truncated/non-IN records before considering an endpoint.
function records(b,id) {
  if (b.length<12 || b.length>9000 || b.readUInt16BE(0)!==id || (b.readUInt16BE(2)&0xfa0f)!==0x8000) return []
  function name(p) {
    let end, labels=[], size=0
    for(let n=0;n<96;n++) {
      const k=b.readUInt8(p++)
      if (!k) return [labels.join('.').toLowerCase(),end??p]
      if ((k&192)===192) { const ptr=((k&63)<<8)|b.readUInt8(p++); if(ptr>=p-2) break; end??=p; p=ptr; continue }
      if (k>63 || (size+=k+1)>255 || p+k>b.length) break
      const label=b.toString('latin1',p,p+k); if(!/^[a-z\d_-]+$/i.test(label)) throw Error('DNS label')
      labels.push(label); p+=k
    }
    throw Error('DNS name')
  }
  let pos=12, out=[]
  const qs=b.readUInt16BE(4), rr=b.readUInt16BE(6)+b.readUInt16BE(8)+b.readUInt16BE(10)
  if(qs>8 || rr>100) return []
  for(let i=0;i<qs;i++) pos=name(pos)[1]+4
  for(let i=0;i<rr;i++) {
    const [key,start]=name(pos), type=b.readUInt16BE(start), cl=b.readUInt16BE(start+2), ttl=b.readUInt32BE(start+4), len=b.readUInt16BE(start+8), r=start+10
    pos=r+len; if(pos>b.length) throw Error('DNS data'); if(!(ttl && (cl&32767)===1)) continue
    if(type===12 || (type===33 && len>=7)) {
      const [value,end]=name(r+(type===33?6:0)); if(end!==pos) continue
      out.push({key,type,value,port:type===33?b.readUInt16BE(r+4):0})
    } else if(type===1 && len===4) out.push({key,type,value:Array.from(b.subarray(r,pos)).join('.')})
  }
  return out
}
function browse(address) {
  return new Promise(resolve => {
    const s=dgram.createSocket('udp4'), id=randomInt(1,65536), seen=[], asked=new Set()
    let done=false, retry
    const finish=(ep=null)=>{ if(done)return; done=true; clearTimeout(timer); clearTimeout(retry); try{s.close()}catch{} resolve(ep) }
    const timer=setTimeout(finish,2300)
    function send(n,t) { s.send(question(id,n,t),5353,group,err=>{if(err)finish()}) }
    s.once('error',()=>finish())
    s.on('message',(b,src)=>{
      if(done || src.address!==address || src.port!==5353 || seen.length>=128) return
      try { seen.push(...records(b,id)) } catch {return}
      function request(n,t){const k=n+':'+t;if(asked.size<12 && !asked.has(k)){asked.add(k);send(n,t)}}
      for(const ptr of seen.filter(r=>r.type===12 && r.key===service && r.value.endsWith('.'+service))) {
        const srv=seen.find(r=>r.type===33 && r.key===ptr.value && r.port>0 && r.value.endsWith('.local'))
        if(!srv){request(ptr.value,33);continue}
        if(seen.some(r=>r.type===1 && r.key===srv.value && r.value===address)){finish(`${address}:${srv.port}`);return}
        request(srv.value,1)
      }
    })
    s.bind(0,address,()=>{try{s.setMulticastInterface(address);s.setMulticastTTL(255);send(service,12);retry=setTimeout(()=>send(service,12),950)}catch{finish()}})
  })
}
// This path intentionally has no dependency on 'adb devices', cached ports, or shell access.
export async function discoverLocal() { return (await Promise.all(wifiAddresses().map(browse))).filter(Boolean) }

function transports(text) {
  const local=new Set(['127.0.0.1',...wifiAddresses()])
  return text.split('\n').flatMap(line=>{
    const m=/^(\d+\.\d+\.\d+\.\d+):(\d{1,5})\s+device\s+.*\btransport_id:(\d+)\s*$/.exec(line)
    return m && local.has(m[1]) && +m[2]>0 && +m[2]<=65535 ? [{endpoint:`${m[1]}:${m[2]}`,id:m[3]}] : []
  })
}
export function serviceState(dump,user) {
  if(!dump.startsWith('ACTIVITY MANAGER SERVICES (dumpsys activity services)') || /permission denial|exception|timed out|\bTIMEOUT\b|dump failed/i.test(dump)) return null
  if(dump.trim()==='ACTIVITY MANAGER SERVICES (dumpsys activity services)\n  (nothing)') return false
  if(/(?:pending|restarting|destroying) services:/i.test(dump)) return null
  if(!dump.includes(`User ${user} active services:`)) return null
  const lines=dump.split('\n'), needle=`u${user} ${pkg}/com.github.kr328.clash.service.`
  let active=false, uncertain=false
  for (let i=0;i<lines.length;i++) {
    if(!/^\s*\* ServiceRecord\{/.test(lines[i]))continue
    const target=lines[i].includes(needle+'TunService}') || lines[i].includes(needle+'ClashService}')
    if(!target)continue
    let j=i+1; while(j<lines.length && !/^\s*\* ServiceRecord\{/.test(lines[j]))j++
    const block=lines.slice(i+1,j).join('\n')
    if(/^\s*app=ProcessRecord\{/m.test(block) && /\bisForeground=true\b/.test(block)) active=true
    else uncertain=true
  }
  return active?true:uncertain?null:false
}

export async function run(action) {
  if(!['on','off','status'].includes(action)) return {connected:false,running:null,message:'不支持的操作。'}
  const deadline=Date.now()+17000; let device
  const env={...process.env}
  for (const key of ['ADB_SERVER_SOCKET','ANDROID_ADB_SERVER_ADDRESS','ANDROID_ADB_SERVER_PORT']) delete env[key]
  const adb=async (...args)=>{
    const left=deadline-Date.now(); if(left<=0)throw Error('deadline')
    return (await exec(adbPath,['-H','127.0.0.1','-P','5037',...args],{env,timeout:Math.min(3500,left),killSignal:'SIGKILL',maxBuffer:512*1024})).stdout.trim()
  }
  try {
    if (process.platform !== 'android') return {connected:false,running:null,message:'Requires native Termux Node on Android.'}
    try { await exec(adbPath,['-P','5037','start-server'],{env,timeout:4200,killSignal:'SIGKILL',maxBuffer:8192}) }
    catch { return {connected:false,running:null,message:'Could not start the local Termux ADB server. Run adb start-server in Termux.'} }
    const boot=(await readFile(bootIdPath,'utf8')).trim()
    if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(boot)) throw Error('boot')
    const verified=async candidates=>{
      for(const t of candidates.slice(0,6)) {
        try {
          const shell=(...cmd)=>adb('-t',t.id,'shell',...cmd)
          const [remote,user]= (await shell('cat /proc/sys/kernel/random/boot_id; am get-current-user')).split(/\r?\n/)
          if(remote===boot && /^\d{1,5}$/.test(user))return {...t,shell,user}
        }catch{/* reject offline or mismatching transports */}
      }
    }
    device=await verified(transports(await adb('devices','-l')))
    if(!device) for(const ep of await discoverLocal()) {
      if(!wifiAddresses().includes(ep.split(':')[0]))continue
      await adb('connect',ep)
      device=await verified(transports(await adb('devices','-l')).filter(t=>t.endpoint===ep)); if(device)break
    }
    if(!device)return {connected:false,running:null,message:'未发现已配对的本机 ADB。请检查 Wi-Fi、无线调试和配对状态，再刷新。'}
    const {shell,user,endpoint}=device
    const result=(running,message)=>({connected:true,running,message,endpoint})
    if(!/^package:\/.*\/base\.apk$/m.test(await shell('pm','path','--user',user,pkg)))return result(null,'本机当前用户未安装 Clash Meta。')
    const state=async()=>serviceState(await shell('dumpsys','activity','services','--user',user,pkg),user)
    const wanted=action==='on', before=await state()
    if(action==='status' || before===wanted) return result(before,before===null?'无法确认 Clash 服务状态。':before?'Clash 服务已开启。':'Clash 服务已关闭。')
    const intent=`${pkg}.action.${wanted?'START':'STOP'}_CLASH`
    // Resolve implicitly within this package first: specifying -n here would
    // only prove component existence, not that it handles this exact action.
    if(!(await shell('cmd','package','resolve-activity','--brief','--user',user,'-a',intent,'-p',pkg)).split(/\r?\n/).includes(component))return result(before,'当前 Clash 版本未提供预期的控制入口。')
    const response=await shell('am','start','--user',user,'-a',intent,'-n',component)
    if(!response.includes('Starting: Intent') || /error|exception|permission denial/i.test(response)) return result(null,'Android 未接受 Clash 控制请求。')
    let observed=null
    for(let i=0;i<7 && Date.now()+300<deadline;i++){await delay(i?450:250);observed=await state();if(observed===wanted)break}
    return result(observed,observed===wanted?(wanted?'Clash 服务已开启。':'Clash 服务已关闭。'):'请求已发送，尚未确认状态变化；请检查手机上的授权或配置，再刷新。')
  } catch (error) {const code=String(error?.code??error?.name??'error').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40);return {diagnostic:code,connected:!!device,running:null,...(device?{endpoint:device.endpoint}:{}),message:device?'ADB 操作失败或超时，无法确认 Clash 状态。':'无法验证本机 ADB。请确认无线调试已开启且已配对。'}}
}
