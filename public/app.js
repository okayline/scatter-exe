// The page: draws the frame, runs the 2:00 timer and sends the sheet. The rules are in engine/scatter.js; the server
// keeps the start time and checks every answer again.
import * as S from "./engine/scatter.js";

const $ = (id) => document.getElementById(id);
const FW = 80;   // the frame is 80 columns, like 4Dungeon's
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const pad = (s, n) => s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);

let T = null;          // the server's view of today (worker.js view)
let deadline = 0;      // when the time is up, on this page's clock (performance.now seconds)
let sending = false;

// [[text, class, key], ...] padded to n visible columns; a part with a key is a button
function seg(parts, n) {
  let len = 0, html = "";
  for (const [t, c, k] of parts) {
    const tt = t.slice(0, n - len); len += tt.length;
    html += c || k ? `<span${c ? ` class="${c}"` : ""}${k ? ` data-k="${k}"` : ""}>${esc(tt)}</span>` : esc(tt);
  }
  return html + " ".repeat(Math.max(0, n - len));
}
const line = (parts) => "|" + seg(parts, FW - 2) + "|";
const centred = (t, c = "t") => line([[" ".repeat(Math.max(0, Math.floor((FW - 2 - t.length) / 2))) + t, c]]);
const clock = (secs) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
const hhmm = (secs) => `${Math.floor(secs / 3600)}H ${String(Math.floor(secs / 60) % 60).padStart(2, "0")}M`;

// a draft of this day's answers, kept in this browser so a reload mid-sheet doesn't lose them (a convenience only)
const draftKey = () => "sx-draft-" + T.day;
const loadDraft = () => { try { return JSON.parse(localStorage.getItem(draftKey())) || []; } catch { return []; } };
const saveDraft = (a) => { try { localStorage.setItem(draftKey(), JSON.stringify(a)); } catch {} };

function draw() {
  const top = "+" + "=".repeat(FW - 2) + "+", dash = "+" + "-".repeat(FW - 2) + "+";
  const letter = T.letter || "?";
  const right = `${T.day}   LETTER `;
  const head = "|" + seg([[" SCATTER.EXE", "b"], [" ".repeat(FW - 2 - 12 - right.length - 1 - 12), ""], [right, "t"], [letter, "g"]], FW - 2 - 12)
    + `<span id="time" class="b">${pad("", 12)}</span>|`;
  const rows = [];
  if (T.state === "playing" || T.state === "sealed") {
    const draft = T.state === "sealed" ? T.answers : loadDraft();
    rows.push(line([[""]]));
    T.categories.forEach((c, i) => {
      const label = " " + pad(`${String(i + 1).padStart(2)}. ${c}`, 40);
      const a = draft[i] || "";
      const box = T.state === "sealed" ? seg([[a || "-", a ? "b" : "d"]], 36)
        : `<input class="ans${S.fits(a, T.letter) ? "" : " bad"}" data-i="${i}" maxlength="${S.MAX_LEN}" autocomplete="off" autocapitalize="words" spellcheck="false" value="${esc(a)}">`;
      rows.push("|" + seg([[label, "t"]], 41) + box + " ".repeat(FW - 2 - 41 - 36) + "|");
      rows.push(line([[""]]));
    });
  } else {
    const say = T.state === "late"
      ? [["TIME RAN OUT BEFORE YOUR SHEET ARRIVED.", "e"], ["NOTHING WAS SEALED TODAY.", "t"], ["", ""], [`NEXT LETTER IN ${hhmm(T.nextIn)}`, "t"]]
      : [["ONE LETTER. 8 CATEGORIES. 2:00.", "b"], ["", ""],
         ["WRITE ONE ANSWER FOR EACH CATEGORY,", "t"], ["EVERY ONE STARTING WITH THE DAY'S LETTER.", "t"], ["", ""],
         ["THE GOAL: ANSWERS NOBODY ELSE WILL GIVE.", "t"], ["YOUR SHEET IS SEALED ON THE LEDGER WHEN THE TIME IS UP.", "t"],
         ["(COMPARING SHEETS AND SCORES ARE NOT BUILT YET.)", "d"], ["", ""],
         ["ONE TRY A DAY. THE LETTER SHOWS WHEN YOU START.", "t"]];
    const blank = Math.floor((17 - say.length) / 2);
    for (let i = 0; i < 17; i++) { const s = say[i - blank]; rows.push(s && s[0] ? centred(s[0], s[1]) : line([[""]])); }
  }
  const status = `<span id="status">${seg([[" " + statusText(), "t"]], FW - 2)}</span>`;
  const buttons = T.state === "new" ? [["[S]TART", "btn", "s"]]
    : T.state === "playing" ? [["[D]ONE", "btn", "d"]]
    : [[`NEXT LETTER IN ${hhmm(T.nextIn)}`, "d"]];
  const width = buttons.reduce((n, [t]) => n + t.length, 0);
  $("frame").innerHTML = [top, head, top, ...rows, top, "|" + status + "|", dash,
    line([[" ".repeat(FW - 3 - width), ""], ...buttons, [" ", ""]]), top].join("\n");
  tick();
}

function statusText() {
  if (T.state === "sealed") return `SEALED ON THE LEDGER: ENTRY #${T.entry}  ${T.hash.slice(0, 16)}...`;
  if (T.state === "playing") {
    const bad = boxes().findIndex((b) => !S.fits(b.value, T.letter));
    return bad >= 0 ? `BOX ${bad + 1} DOESN'T START WITH ${T.letter}. FIX IT OR CLEAR IT.` : `ENTER FOR THE NEXT BOX. BLANKS ARE ALLOWED (THEY SCORE 0).`;
  }
  return T.state === "late" ? "" : "PRESS START WHEN YOU'RE READY. THE CLOCK DOESN'T STOP.";
}
function setStatus(t, c = "t") { $("status").innerHTML = seg([[" " + t, c]], FW - 2); }

const boxes = () => [...document.querySelectorAll(".ans")];

// the clock in the corner; at 0:00 the sheet goes in by itself
function tick() {
  const el = $("time");
  if (!el) return;
  if (T.state !== "playing") { el.innerHTML = esc(pad(T.state === "sealed" ? "  SEALED" : "  TIME " + clock(T.time), 12)); return; }
  const left = Math.max(0, deadline - performance.now() / 1000);
  el.className = left <= 10 ? "e" : "b";
  el.textContent = pad("  TIME " + clock(Math.ceil(left)), 12);
  if (left <= 0) send(true);
}
setInterval(() => T && tick(), 200);

async function api(method, path, body) {
  const r = await fetch(path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({ error: "The server didn't answer." }));
  if (!r.ok) throw new Error(j.error || "That didn't work.");
  return j;
}

function show(t) {
  T = t;
  deadline = performance.now() / 1000 + (t.left ?? 0);
  draw();
  if (T.state === "playing") (boxes().find((b) => !b.value) || boxes()[0]).focus();
}

async function begin() {
  if (T.state !== "new" || sending) return;
  sending = true;
  try { show(await api("POST", "/api/start")); }
  catch (e) { setStatus(e.message.toUpperCase(), "e"); }
  sending = false;
}

// Send the sheet. At 0:00 (auto) a box that doesn't start with the letter goes in blank; DONE waits until they're fixed.
async function send(auto = false) {
  if (T.state !== "playing" || sending) return;
  const answers = boxes().map((b) => S.fits(b.value, T.letter) ? S.clean(b.value) : "");
  if (!auto && boxes().some((b) => !S.fits(b.value, T.letter))) return setStatus(statusText(), "e");
  sending = true;
  boxes().forEach((b) => (b.disabled = true));
  setStatus("SEALING YOUR SHEET...");
  try { show(await api("POST", "/api/sheet", { day: T.day, answers })); }
  catch (e) {
    try { show(await api("GET", "/api/today")); } catch {}
    setStatus(e.message.toUpperCase(), "e");
  }
  sending = false;
}

$("frame").addEventListener("input", (ev) => {
  const b = ev.target.closest(".ans");
  if (!b) return;
  b.classList.toggle("bad", !S.fits(b.value, T.letter));
  saveDraft(boxes().map((x) => x.value));
  setStatus(statusText(), boxes().some((x) => !S.fits(x.value, T.letter)) ? "e" : "t");
});
// pointerdown, not click, like TILT.EXE's buttons
$("frame").addEventListener("pointerdown", (ev) => {
  const k = ev.target.closest("[data-k]")?.dataset.k;
  if (k === "s") begin(); else if (k === "d") { ev.preventDefault(); send(); }
});
document.addEventListener("keydown", (ev) => {
  if (!T) return;
  const b = ev.target.closest?.(".ans");
  if (b) {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    const all = boxes(), i = all.indexOf(b);
    if (i < all.length - 1) all[i + 1].focus(); else send();
    return;
  }
  const k = ev.key.toLowerCase();
  if (k === "s") begin(); else if (k === "d") send();
});

T = { day: "", state: "new", time: S.TIME, nextIn: 0 };
$("frame").textContent = "LOADING TODAY'S LETTER...";
api("GET", "/api/today").then(show).catch(() => ($("frame").textContent = "CAN'T REACH THE SERVER. RELOAD TO TRY AGAIN."));
