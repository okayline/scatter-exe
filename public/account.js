// USER: save codes and passkeys (the shared 88x31 accounts) and the copy you carry into every 88x31 game. A save code
// or passkey brings your player to another browser and works in the other 88x31 games too. Ported from moba-beat
// public/account.js (v0.11). It makes its own [USER] button (inside the element with id "version", else class "ver") and its own panel.
const NAME = document.title.replace(/[^A-Za-z0-9.]+/g, "-").toLowerCase();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
async function api(path, data) {
  const r = await fetch("/api/" + path, data ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) } : {});
  return r.json().catch(() => ({ error: "That didn't work. Try again." }));
}
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (t) => { t = t.replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(t + "===".slice((t.length + 3) % 4)), (c) => c.charCodeAt(0)); };
const pkOk = () => !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create);
const day = (s) => new Date(s * 1000).toLocaleDateString([], { month: "short", day: "numeric" });
const device = () => { const u = navigator.userAgent; return /Android/.test(u) ? "Android" : /iPhone|iPad/.test(u) ? "iPhone" : /Mac/.test(u) ? "Mac" : /Windows/.test(u) ? "Windows PC" : "This device"; };
const pkOops = (e) => (e && e.name === "NotAllowedError" ? "Passkey cancelled (or it timed out)." : (e && e.message) || "The passkey didn't work.");

const css = document.createElement("style");
css.textContent = `
  #account { position: fixed; inset: 0; z-index: 50; overflow: auto; background: var(--bg, #07090a); color: var(--fg, #e4e4df);
    font-family: var(--mono, ui-monospace, monospace); font-size: 20px; line-height: 1.3; padding: 16px; box-sizing: border-box; }
  #account .in { max-width: 560px; margin: 0 auto; }
  #account h2, #account h3 { font: inherit; margin: 0 0 6px; color: var(--bright, #fff); }
  #account .p { border: 1px solid var(--dim, #4f5d52); padding: 10px; margin: 10px 0; }
  #account .r { display: flex; gap: 10px; align-items: center; justify-content: space-between; margin: 4px 0; flex-wrap: wrap; }
  #account .m { color: var(--trail, #8f8f8a); margin: 4px 0; }
  #account .gold, #account .gold h3 { color: var(--gold, #e3b341); border-color: var(--gold, #e3b341); }
  #account button { font: inherit; background: none; color: var(--bright, #fff); border: 1px solid var(--dim, #4f5d52); padding: 2px 10px; cursor: pointer; }
  #account button:hover { background: var(--fg, #e4e4df); color: var(--bg, #07090a); }
  #account input { font: inherit; background: #141a16; color: var(--bright, #fff); border: 0; padding: 2px 6px; min-width: 0; flex: 1; }
  #account .code { font-size: 1.3em; color: var(--gold, #e3b341); word-break: break-all; }
  .userbtn { cursor: pointer; color: var(--bright, #fff); margin-right: 1ch; } .userbtn:hover { background: var(--fg, #e4e4df); color: var(--bg, #07090a); }`;
document.head.append(css);
const el = document.createElement("div");
el.id = "account"; el.hidden = true; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "User");
document.body.append(el);
el.addEventListener("keydown", (e) => e.stopPropagation());   // typing a save code never presses the game's keys
let newCode = null;

async function show(msg = "") {
  const a = await api("account");
  if (a.error) { el.innerHTML = `<div class="in"><p class="m">${esc(a.error)}</p><button id="aclose" type="button">Close</button></div>`; return wire(); }
  const has = a.codes.length || a.passkeys.length;
  el.innerHTML = `<div class="in">
    <div class="r"><h2>USER</h2><button id="aclose" type="button">Close</button></div>
    <p class="m">${a.player ? `You're player ${a.id}, saved on ${a.devices} device${a.devices > 1 ? "s" : ""}.` : "No player here yet. Play a round, or log in below."}
      A save code or passkey brings your player to another browser, and works in the other 88x31 games too.</p>
    ${newCode ? `<div class="p gold"><h3>Your new save code (shown once)</h3><div class="code">${esc(newCode)}</div>
      <p class="m">Write it down or keep it somewhere safe. Only a fingerprint of it is stored.</p>
      <div class="r"><button id="copycode" type="button">Copy</button><button id="dlcode" type="button">Download as a text file</button></div></div>` : ""}
    ${a.player ? carryPanel(a) : ""}
    <div class="p"><h3>Save codes (${a.codes.length}/5)</h3>
      ${a.codes.map((c) => `<div class="r"><span class="m">made ${day(c.created_at)}${c.last_used_at ? ", used " + day(c.last_used_at) : ""}</span><button data-rm="codes" data-id="${c.id}" type="button">Forget</button></div>`).join("") || '<p class="m">None yet.</p>'}
      <button id="mkcode" type="button">Make a save code</button></div>
    <div class="p"><h3>Passkeys (${a.passkeys.length})</h3>
      ${a.passkeys.map((k) => `<div class="r"><span class="m">${esc(k.label || "passkey")}${k.created_at ? ", made " + day(k.created_at) : ""}</span><button data-rm="passkey" data-id="${k.id}" type="button">Forget</button></div>`).join("") || '<p class="m">None yet.</p>'}
      ${pkOk() ? '<button id="mkpk" type="button">Add a passkey</button>' : '<p class="m">This browser can\'t do passkeys. Use a save code instead.</p>'}</div>
    <div class="p"><h3>Log in on this device</h3>
      <div class="r"><input id="codein" placeholder="Save code" autocomplete="off" spellcheck="false" aria-label="Save code"><button id="usecode" type="button">Use code</button></div>
      ${pkOk() ? '<button id="pklogin" type="button">Log in with a passkey</button>' : ""}</div>
    ${has ? '<button id="logout" type="button">Log out of this browser</button>' : ""}
    <p class="m" id="amsg" role="status">${esc(msg)}</p></div>`;
  wire(a);
}

// Carry: the copy you carry into every 88x31 game (gold if the Moon blessed it), and every copy your account holds in
// any game, newest first, each with Pin.
function carryPanel(a) {
  const list = a.copies || [], on = list.find((x) => x.pinned) || list[0];
  return `<div class="p${a.carry && a.carry.blessed ? " gold" : ""}"><h3>Carry</h3>
      <p class="m">${a.carry ? `Carrying ${esc(a.carry.name)} #${a.carry.copy}. ${esc(window.CARRY_NOTE || "")}` : "You don't hold any copies yet."}</p>
      ${list.slice(0, 12).map((x, i) => `<div class="r"><span class="m">${esc(x.name)} #${x.copy} · ${esc(x.game)}</span>${x === on ? '<span class="m">carrying</span>' : `<button data-pin="${i}" type="button">Pin</button>`}</div>`).join("")}</div>`;
}

function wire(a) {
  const $ = (id) => el.querySelector("#" + id), say = (t) => { const m = $("amsg"); if (m) m.textContent = t; };
  const on = (id, f) => { const b = $(id); if (b) b.onclick = async () => { try { await f(); } catch (e) { say(e.message || String(e)); } }; };
  const changed = async (msg) => { newCode = null; await show(msg); };
  on("aclose", async () => { newCode = null; el.hidden = true; });
  on("mkcode", async () => { const r = await api("codes", { action: "new" }); if (r.error) return say(r.error); newCode = r.code; await show(); });
  on("copycode", async () => { try { await navigator.clipboard.writeText(newCode); say("Copied. Keep it somewhere safe."); } catch { say("Couldn't copy. Select the code and copy it by hand."); } });
  on("dlcode", async () => {
    const text = `${document.title} save code\r\n\r\n  ${newCode}\r\n\r\nOn any browser: open ${location.origin}, open USER, and use this code under "Log in on this device".\r\nIt works in the other 88x31 games too. Keep it private: anyone with it can log in as you.\r\n`;
    const l = document.createElement("a");
    l.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); l.download = NAME + "-save-code.txt";
    document.body.append(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(l.href), 1000);
  });
  el.querySelectorAll("[data-rm]").forEach((b) => b.onclick = async () => {
    const r = await api(b.dataset.rm, { action: "remove", id: Number(b.dataset.id) }); if (r.error) return say(r.error); await show("Forgotten.");
  });
  el.querySelectorAll("[data-pin]").forEach((b) => b.onclick = async () => {
    const x = a.copies[Number(b.dataset.pin)];
    const r = await api("pin", { itemId: x.itemId, copy: x.copy }); if (r.error) return say(r.error); await show("Pinned. Every game carries it now.");
  });
  on("usecode", async () => { const r = await api("load", { code: $("codein").value.trim() }); if (r.error) return say(r.error); await changed("Logged in. Reload to play as that player."); });
  on("logout", async () => { const r = await api("logout", {}); if (r.error) return say(r.error); await changed("Logged out."); });
  on("mkpk", async () => {
    say("Waiting for your fingerprint, face or PIN...");
    try {
      const o = await api("passkey", { action: "register_options" }); if (o.error) return say(o.error);
      const cred = await navigator.credentials.create({ publicKey: { ...o, challenge: unb64(o.challenge), user: { ...o.user, id: unb64(o.user.id) }, excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: unb64(c.id) })) } });
      const r = await api("passkey", { action: "register", label: device(), credential: { id: cred.id, response: { clientDataJSON: b64(cred.response.clientDataJSON), attestationObject: b64(cred.response.attestationObject) } } });
      if (r.error) return say(r.error);
      await changed("Passkey added.");
    } catch (e) { say(pkOops(e)); }
  });
  on("pklogin", async () => {
    say("Waiting for your passkey...");
    try {
      const o = await api("passkey", { action: "login_options" }); if (o.error) return say(o.error);
      const cred = await navigator.credentials.get({ publicKey: { ...o, challenge: unb64(o.challenge) } });
      const r = await api("passkey", { action: "login", credential: { id: cred.id, response: { clientDataJSON: b64(cred.response.clientDataJSON), authenticatorData: b64(cred.response.authenticatorData), signature: b64(cred.response.signature) } } });
      if (r.error) return say(r.error);
      await changed("Logged in. Reload to play as that player.");
    } catch (e) { say(pkOops(e)); }
  });
}

const btn = document.createElement("span");
btn.className = "userbtn"; btn.textContent = "[USER]"; btn.setAttribute("role", "button"); btn.tabIndex = 0;
btn.onclick = async () => { el.hidden = !el.hidden; if (!el.hidden) await show(); };
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.hidden) { newCode = null; el.hidden = true; } });
(document.getElementById("version") || document.querySelector(".ver") || document.body).prepend(btn);
