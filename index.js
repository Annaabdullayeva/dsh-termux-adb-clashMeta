import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {fileURLToPath} from 'node:url'
const execute = promisify(execFile)
// The DSH host uses glibc Node, whose getifaddrs() cannot enumerate Android Wi-Fi.
// Execute discovery with the native Termux Node instead, using fixed argv only.
async function run(action) {
  const {stdout} = await execute('/data/data/com.termux/files/usr/bin/node', [fileURLToPath(new URL('./worker.mjs',import.meta.url)),action],{timeout:22000,killSignal:'SIGKILL',maxBuffer:8192})
  return JSON.parse(stdout)
}

export const inject = ['connection', 'webServer']
const endpoints = new Map(['status', 'on', 'off'].map(action => [`termux-adb-clash.${action}`, action]))
const fail = (code, message) => ({ok: false, error: {code, message, details: {}}})

export function apply(ctx) {
  let active, disposed = false
  const exec = action => {
    if (active) {
      if (action === 'status') return active
      throw new Error('已有操作正在进行，请稍后刷新。')
    }
    active = Promise.resolve().then(() => run(action)).finally(() => { active = undefined })
    return active
  }
  ctx.inject?.(['tools'], scoped => {
    scoped.effect(() => scoped.tools.register({
      name: 'termux_adb_clash', deferLoading: true,
      description: '查询本机已配对的安卓设备或按用户要求开启、停止 Clash Meta。停止可能中断代理连接。',
      parameters: {type:'object', properties:{action:{type:'string',enum:['status','on','off']}}, required:['action'], additionalProperties:false},
      output: {schema:{type:'object',properties:{connected:{type:'boolean'},running:{oneOf:[{type:'boolean'},{type:'null'}]},message:{type:'string'},endpoint:{type:'string'}}},render:(_,value)=>[{type:'text',text:JSON.stringify(value)}]},
      async execute(args) {
        if (!args || !['status','on','off'].includes(args.action) || Object.keys(args).length !== 1) throw new Error('未知操作。')
        return exec(args.action)
      }
    }))
  })
  ctx.effect(() => {
    const invoke = async (e, payload, signal, peer) => {
      if (peer.id !== ctx.connection.browserPeer.id || peer.principal.kind !== 'owner') return fail('forbidden', '仅限已登录的网页所有者。')
      if (disposed || signal.aborted) return fail('cancelled', '操作已取消。')
      if (!endpoints.has(e) || (payload != null && (typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).length))) return fail('invalid-request', '不接受命令或地址参数。')
      try { return {ok: true, value: await exec(endpoints.get(e))} }
      catch (err) { return fail('clash-error', err instanceof Error ? err.message : '操作失败。') }
    }
    const removers = [...endpoints.keys()].map(e => ctx.connection.fetch.register({
      path:'/api/'+e, methods:['POST'], requestBody:'buffered', async fetch(req) {
        const admission = ctx.connection.admit(req)
        if ('rejection' in admission) return new Response('forbidden',{status:admission.rejection})
        if (req.headers.get('content-type')?.split(';')[0] !== 'application/json') return new Response('expected JSON',{status:415})
        const m = await req.json().catch(()=>null)
        if (!m || m.type !== 'client-request' || m.method !== e || typeof m.rpcId !== 'string') return new Response('invalid request',{status:400})
        return Response.json({type:'server-response',rpcId:m.rpcId,result:await invoke(e,m.payload,req.signal,admission.peer)},{headers:{'cache-control':'no-store'}})
      }
    }))
    const remove = () => Promise.all(removers.map(f => f()))
    // Best effort. Never toggle the VPN as a side effect of loading the panel.
    exec('status').catch(() => {})
    return () => { disposed = true; return remove() }
  })
}
