import { createFileRoute } from "@tanstack/react-router";

const WIDGET_JS = `(function(){
  if (window.__useCrmSiteChatLoaded) return;
  window.__useCrmSiteChatLoaded = true;

  var script = document.currentScript;
  var SITE_KEY = (script && script.getAttribute('data-site-key')) || window.USE_CRM_SITE_KEY;
  var API = (script && script.getAttribute('data-api')) || (location.origin);
  if (!SITE_KEY) { console.warn('[USE PATRIUM] data-site-key missing'); return; }

  var STORAGE = 'usecrm_site_chat_' + SITE_KEY;
  function load(){ try { return JSON.parse(localStorage.getItem(STORAGE)||'null'); } catch(_){ return null; } }
  function save(v){ try { localStorage.setItem(STORAGE, JSON.stringify(v)); } catch(_){} }
  var state = load() || { token:null, msgs:[], lastTs:null };

  var css = '.uc-bub{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;background:#4f46e5;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.2);z-index:2147483646;border:0}.uc-bub svg{width:26px;height:26px}.uc-win{position:fixed;bottom:88px;right:20px;width:340px;max-width:calc(100vw - 24px);height:480px;max-height:calc(100vh - 120px);background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;z-index:2147483647;color:#0f172a}.uc-win.open{display:flex}.uc-hd{background:#4f46e5;color:#fff;padding:14px 16px;font-weight:600}.uc-msgs{flex:1;overflow-y:auto;padding:12px;background:#f8fafc;display:flex;flex-direction:column;gap:8px}.uc-m{max-width:80%;padding:8px 12px;border-radius:12px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word}.uc-m.v{align-self:flex-end;background:#4f46e5;color:#fff;border-bottom-right-radius:4px}.uc-m.a{align-self:flex-start;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-bottom-left-radius:4px}.uc-m.s{align-self:center;background:transparent;color:#64748b;font-size:12px}.uc-form{padding:12px;border-top:1px solid #e2e8f0;background:#fff;display:flex;flex-direction:column;gap:8px}.uc-form input,.uc-form textarea{border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:14px;font-family:inherit;outline:0;width:100%;box-sizing:border-box}.uc-form input:focus,.uc-form textarea:focus{border-color:#4f46e5}.uc-form textarea{resize:none;min-height:60px}.uc-form button{background:#4f46e5;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-size:14px;font-weight:500;cursor:pointer}.uc-form button:disabled{opacity:.5;cursor:not-allowed}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var bub = document.createElement('button');
  bub.className = 'uc-bub'; bub.setAttribute('aria-label','Abrir chat');
  bub.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  document.body.appendChild(bub);

  var win = document.createElement('div');
  win.className = 'uc-win';
  win.innerHTML = '<div class="uc-hd">Fale com a gente</div><div class="uc-msgs"></div><div class="uc-form"></div>';
  document.body.appendChild(win);
  var msgsEl = win.querySelector('.uc-msgs');
  var formEl = win.querySelector('.uc-form');

  function api(action, payload){
    var headers = { 'Content-Type':'application/json', 'x-site-key': SITE_KEY };
    if (state.token) headers['x-visitor-token'] = state.token;
    return fetch(API + '/api/public/site-chat', { method:'POST', headers: headers, body: JSON.stringify(Object.assign({ action: action }, payload||{})) })
      .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error||'erro'); return j; }); });
  }
  function render(){
    msgsEl.innerHTML = '';
    state.msgs.forEach(function(m){
      var d = document.createElement('div');
      d.className = 'uc-m ' + (m.sender_kind === 'visitor' ? 'v' : m.sender_kind === 'agent' ? 'a' : 's');
      d.textContent = m.body;
      msgsEl.appendChild(d);
    });
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function renderForm(){
    if (!state.token){
      formEl.innerHTML = '<input id="uc-name" placeholder="Seu nome (opcional)" maxlength="150"/><input id="uc-email" type="email" placeholder="Email (opcional)" maxlength="255"/><textarea id="uc-msg" placeholder="Como podemos ajudar?" maxlength="4000"></textarea><button id="uc-start">Iniciar conversa</button>';
      formEl.querySelector('#uc-start').onclick = function(){
        var msg = formEl.querySelector('#uc-msg').value.trim();
        if (!msg) return;
        var btn = formEl.querySelector('#uc-start'); btn.disabled = true; btn.textContent = 'Enviando…';
        api('start', { visitor_name: formEl.querySelector('#uc-name').value, visitor_email: formEl.querySelector('#uc-email').value, page_url: location.href, referrer: document.referrer })
          .then(function(r){ state.token = r.visitor_token; save(state); return api('send', { body: msg }); })
          .then(function(){ poll(); renderForm(); })
          .catch(function(e){ btn.disabled = false; btn.textContent = 'Iniciar conversa'; alert('Erro: '+e.message); });
      };
    } else {
      formEl.innerHTML = '<textarea id="uc-msg" placeholder="Digite sua mensagem…" maxlength="4000"></textarea><button id="uc-send">Enviar</button>';
      var send = function(){
        var ta = formEl.querySelector('#uc-msg'); var b = ta.value.trim(); if (!b) return;
        var btn = formEl.querySelector('#uc-send'); btn.disabled = true;
        api('send', { body: b }).then(function(){ ta.value=''; btn.disabled=false; poll(); }).catch(function(e){ btn.disabled=false; alert('Erro: '+e.message); });
      };
      formEl.querySelector('#uc-send').onclick = send;
      formEl.querySelector('#uc-msg').onkeydown = function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } };
    }
  }
  function poll(){
    if (!state.token) return;
    api('poll', { since: state.lastTs || undefined }).then(function(r){
      if (r.messages && r.messages.length){
        state.msgs = state.msgs.concat(r.messages);
        state.lastTs = r.messages[r.messages.length-1].created_at;
        save(state); render();
      }
    }).catch(function(){});
  }

  bub.onclick = function(){ win.classList.toggle('open'); if (win.classList.contains('open')) { render(); renderForm(); poll(); } };
  setInterval(function(){ if (win.classList.contains('open')) poll(); }, 4000);
})();`;

export const Route = createFileRoute("/api/public/site-chat-widget.js")({
  server: {
    handlers: {
      GET: async () =>
        new Response(WIDGET_JS, {
          status: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
          },
        }),
    },
  },
});
