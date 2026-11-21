import test from 'node:test'
import assert from 'node:assert/strict'
import {discoverLocal,run,serviceState} from '../backend.mjs'
const header='ACTIVITY MANAGER SERVICES (dumpsys activity services)\n'
const block=(name,user=0)=>`${header}  User ${user} active services:\n  * ServiceRecord{123 u${user} com.github.metacubex.clash.meta/com.github.kr328.clash.service.${name}}\n    app=ProcessRecord{abc process}\n    isForeground=true foregroundId=1\n    startingBgTimeout=--`
test('running means active Clash engine, not another app service',()=>{
  for(const n of ['TunService','ClashService'])assert.equal(serviceState(block(n),'0'),true)
  assert.equal(serviceState(block('RemoteService'),'0'),false)
  assert.equal(serviceState(header+'  (nothing)','0'),false)
})
test('incomplete, transitional and cross-user dumps remain unknown',()=>{
  for(const dump of ['permission denial',header,block('TunService',10),block('TunService').replace('isForeground=true','isForeground=false'),block('TunService')+'\nDUMP TIMEOUT'])assert.equal(serviceState(dump,'0'),null)
})
test('unrecognized action cannot invoke ADB',async()=>{
  assert.deepEqual(await run('toggle'),{connected:false,running:null,message:'不支持的操作。'})
})
// Run on the paired handset with wireless debugging enabled. This calls only
// multicast DNS, never the ADB server (so an existing transport cannot mask failure).
test('live cold DNS-SD returns this Wi-Fi endpoint',{skip:!process.env.ZFLIP_LIVE_DISCOVERY},async()=>{
  assert.match((await discoverLocal())[0]??'',/^\d+\.\d+\.\d+\.\d+:\d+$/)
})
