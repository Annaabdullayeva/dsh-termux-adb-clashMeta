window.__ModuleLoader__.load({
  id: 'dsh-termux-adb-clash',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const ns = 'termux.adb.clash';
    const labels = {
      en: { title: 'Clash Meta', adb: 'Local wireless debugging', service: 'Clash Meta', connected: 'Authorized', disconnected: 'Not connected', unknown: 'Unknown', running: 'Running', stopped: 'Stopped', checking: 'Checking…', starting: 'Starting…', stopping: 'Stopping…', refresh: 'Refresh status', on: 'Turn on', off: 'Turn off', retry: 'Check wireless debugging on the phone, then refresh the status.', invalid: 'The host returned an invalid status.', failure: 'Could not check the result. Refresh the status before trying again.', warning: 'Turn off Clash Meta? If you access Harness through Clash, this page may disconnect. Before turning it off, check that you can open Harness on the phone or via its LAN address.' },
      zh: { title: 'Clash Meta', adb: '本机无线调试', service: 'Clash Meta', connected: '已授权', disconnected: '未连接', unknown: '未知', running: '运行中', stopped: '已停止', checking: '正在检查…', starting: '正在开启…', stopping: '正在关闭…', refresh: '刷新状态', on: '开启', off: '关闭', retry: '请在手机上检查无线调试，然后刷新状态。', invalid: '主机返回的状态无效。', failure: '未能确认结果，请刷新状态后再试。', warning: '关闭 Clash Meta？如果正通过 Clash 访问 DSH，本页可能断开。关闭前，请先确认可以在手机本机或通过局域网地址打开 DSH。' },
    };
    const css = `.zfc-panel{min-width:0;color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.5}.zfc-panel dl{margin:0}.zfc-panel dl>div{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:4px 12px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}.zfc-panel dd{margin:0;font-weight:600}.zfc-panel p{margin:10px 0;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.zfc-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.zfc-actions button{min-height:36px;padding:6px 14px;font:inherit;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:inherit;background:var(--dsw-alias-bg-layer-1);cursor:pointer}.zfc-actions button:enabled:hover{background:var(--dsw-alias-interactive-bg-hover)}.zfc-actions button:disabled{color:var(--dsw-alias-label-tertiary);cursor:not-allowed}`;
    return {
      inject: ['locale', 'slots', 'connection'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(ns, labels));
        const t = ctx.locale.bind(ns);
        function Panel() {
          const [snapshot, setSnapshot] = React.useState(null);
          const [busy, setBusy] = React.useState('status');
          const [failure, setFailure] = React.useState(null);
          const active = React.useRef(null);
          const allowed = snapshot?.connected === true && typeof snapshot.running === 'boolean';
          async function request(action) {
            if (active.current || (action !== 'status' && !allowed)) return;
            if (action === 'off' && !window.confirm(t('warning'))) return;
            const controller = new AbortController();
            active.current = controller;
            setBusy(action); setFailure(null);
            try {
              const reply = await ctx.connection.rpc.call('/api', `termux-adb-clash.${action}`, {}, controller.signal);
              if (controller.signal.aborted) return;
              if (!reply.ok) throw new Error(reply.error?.message || t('failure'));
              const s = reply.value;
              if (!s || typeof s.connected !== 'boolean' || (s.running !== null && typeof s.running !== 'boolean') || typeof s.message !== 'string' || (s.endpoint != null && typeof s.endpoint !== 'string')) throw new Error(t('invalid'));
              setSnapshot(s);
            } catch (error) {
              if (!controller.signal.aborted) { setSnapshot(null); setFailure(error?.message || t('failure')); }
            } finally {
              if (active.current === controller) { active.current = null; setBusy(null); }
            }
          }
          React.useEffect(() => {
            request('status');
            return () => { active.current?.abort(); active.current = null; };
          }, []);
          const row = (label, text) => h('div', null, h('dt', null, t(label)), h('dd', null, text));
          const button = (action, label, disabled) => h('button', { type: 'button', disabled: Boolean(busy) || disabled, onClick: () => request(action) }, t(label));
          return h('section', { className: 'zfc-panel', 'aria-label': t('title') }, h('style', null, css),
            h('div', { role: 'status', 'aria-live': 'polite' },
              h('dl', null, row('adb', t(!snapshot ? 'unknown' : snapshot.connected ? 'connected' : 'disconnected')), row('service', t(!allowed ? 'unknown' : snapshot.running ? 'running' : 'stopped'))),
              busy && h('p', null, t(({status:'checking', on:'starting', off:'stopping'})[busy])),
              !busy && snapshot?.endpoint && h('p', null, h('code', null, snapshot.endpoint)),
              !busy && snapshot?.message && h('p', null, snapshot.message),
              !busy && failure && h('p', null, t('failure'), ' ', failure),
              !busy && snapshot?.connected === false && h('p', null, t('retry'))),
            h('div', { className: 'zfc-actions' }, button('status', 'refresh', false), button('on', 'on', !allowed || snapshot.running), button('off', 'off', !allowed || !snapshot.running)));
        }
        ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'dsh-termux-adb-clash', order: 21.5, locale: ns, label: () => t('title') }, Panel));
        ctx.slots.inject('settings.section.icon', () => ctx.slots.register({ name: 'settings.section.icon', id: 'dsh-termux-adb-clash' }, ({ size }) => h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true }, h('rect', { x: 6, y: 2, width: 12, height: 20, rx: 2.5 }), h('path', { d: 'M6 12h12M10.5 19h3' }))));
      },
    };
  },
});
