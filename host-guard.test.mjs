import test from 'node:test'
import assert from 'node:assert/strict'
import {apply} from './index.js'

test('browser only; fixed routes and payload; startup never toggles VPN', async () => {
 const owner={id:'browser',principal:{kind:'owner'}}; let peer=owner, stop; const routes=new Map()
 const connection={browserPeer:owner,admit:()=>peer?{peer}:{rejection:401},fetch:{register(r){routes.set(r.path,r);return ()=>routes.delete(r.path)}}}
 apply({connection,effect:f=>{stop=f()}})
 assert.equal(routes.size,3); assert.ok(!routes.has('/api/termux-adb-clash.shell'))
 const request=async (action,payload)=>{const method='termux-adb-clash.'+action;return routes.get('/api/'+method).fetch(new Request('http://localhost/api/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',method,rpcId:'test',payload})}))}
 peer=null;assert.equal((await request('off',{})).status,401)
 peer={...owner,id:'api'};assert.equal((await (await request('off',{})).json()).result.error.code,'forbidden')
 peer=owner;assert.equal((await (await request('on',{address:'other'})).json()).result.error.code,'invalid-request')
 const status=(await (await request('status',{})).json()).result;assert.equal(status.ok,true);assert.equal(typeof status.value.connected,'boolean')
 await stop();assert.equal(routes.size,0)
})
