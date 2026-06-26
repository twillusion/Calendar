/* ── Anti-snooping ───────────────────────────────────────────── */
(function () {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    const blocked =
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key.toUpperCase())) ||
      (e.ctrlKey && e.key.toUpperCase() === 'U') ||
      (e.metaKey && e.altKey && ['I','J'].includes(e.key.toUpperCase()));
    if (blocked) e.preventDefault();
  });
  let _devOpen = false;
  setInterval(() => {
    const open = window.outerWidth - window.innerWidth > 160 ||
                 window.outerHeight - window.innerHeight > 160;
    if (open && !_devOpen) {
      _devOpen = true;
      if (document.getElementById('gate').style.display === 'none') lockCalendar();
    } else if (!open) { _devOpen = false; }
  }, 1000);
})();

/* ── Encrypted data ──────────────────────────────────────────────
   To update, run in Node.js:
   function xor(s,k){let o='';for(let i=0;i<s.length;i++)o+=String.fromCharCode(s.charCodeAt(i)^k.charCodeAt(i%k.length));return o;}
   console.log(Buffer.from(xor(JSON.stringify(data),'PASSWORD'),'latin1').toString('base64'));
   ─────────────────────────────────────────────────────────────── */
const ENCRYPTED_BLOB = "PE0EGiVcFhpOVjIUTDQbAB40EFhLXlxbWUN3WUxddRBOSwkCDU1UZV1RXnYfUl9BXVBNQmUbCBgsV0BTTi0FDAEmF0NAYkYLBAlOU00vKwNBCCFLQEVODwYDATVNW04iXhcMTkBLCwszDggAYghAKhkfHQADZy4NDy9TGkkYCQQfAiYbBEwmXRBJJC5LEkI8TRIYIUAWS1ZOW19ccUJRWm0AUEtATgwBCmVVQ15wAFREXFpEXVhlQ0MYKUYODE5WSzwoBk8zCTBdEB1OQEsbByoKQ1Zicw4FTAgIFkxrTQIDLF0QS1ZOHQoPK01NTiRXFggFAEtVTBQpIEwDRxEdAwFJPQs3ABMYYFQNG0wvOiBMOkMaTjNGAxsYTlNNXHddV0FwBE9bVU5FTQspC0NWYgBSW1pBWVhDdl9DQGJGCx0ACUtVTA88IEwUeiFJKAkEAExrTRUFLVdAU04tBQNOIw4YTmwQAQYAAxtNVGUBABo5EE5LCAkdDgcrTVtOYk9OEk4fHQ4cM01bTnICUF9BXF5CXnZNTU4lXAZLVk5bX1xxQlFbbQJTS0BOHQYaKwpDVmJ8BxoYAAxPOC4cCBhiHkAdBQEMTVRlLg0AYFYDEE5ASwwBKwATTnoQFgwNAEtDTCMKFQ0pXkBTTk4UMhM=";

/* ── Cipher ──────────────────────────────────────────────────── */
function xorCipher(str, key) {
  let out = '';
  for (let i = 0; i < str.length; i++)
    out += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  return out;
}
function decryptData(blob, password) {
  try { return xorCipher(atob(blob), password); } catch { return null; }
}

/* ── State ───────────────────────────────────────────────────── */
let calendarEvents = [];
let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth();

/* ── Gate logic ──────────────────────────────────────────────── */
function attemptUnlock() {
  const input    = document.getElementById('password-input');
  const errorEl  = document.getElementById('error-msg');
  const password = input.value;

  if (!password) { shakeInput(input); errorEl.textContent = 'Please enter the access code.'; return; }

  const raw = decryptData(ENCRYPTED_BLOB, password);
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch {}

  if (!parsed || !Array.isArray(parsed.events)) {
    shakeInput(input);
    errorEl.textContent = 'Incorrect access code. Try again.';
    input.value = '';
    input.focus();
    return;
  }

  calendarEvents = parsed.events;
  document.getElementById('gate').style.display           = 'none';
  document.getElementById('app-header').style.display     = '';
  document.getElementById('locked-month-bar').style.display = 'none';
  renderCalendar();
}

function lockCalendar() {
  calendarEvents = [];
  document.getElementById('gate').style.display           = '';
  document.getElementById('app-header').style.display     = 'none';
  document.getElementById('locked-month-bar').style.display = '';
  renderCalendar();
  document.getElementById('password-input').focus();
}

function shakeInput(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

document.getElementById('password-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') attemptUnlock();
});

/* ── Calendar rendering ──────────────────────────────────────── */
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const WEEKDAYS    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function ds(y, m, d) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function setMonthLabel() {
  const label = `${MONTH_NAMES[currentMonth]} ${currentYear}`;
  const ml = document.getElementById('month-label');
  const lml = document.getElementById('locked-month-label');
  if (ml)  ml.textContent  = label;
  if (lml) lml.textContent = label;
}

function renderCalendar() {
  setMonthLabel();

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  // Header row
  const headerRow = document.createElement('div');
  headerRow.className = 'cal-header';
  WEEKDAYS.forEach(d => {
    const h = document.createElement('div');
    h.className = 'weekday-header';
    h.textContent = d;
    headerRow.appendChild(h);
  });
  grid.appendChild(headerRow);

  // Build cell list
  const firstDay    = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrev  = new Date(currentYear, currentMonth, 0).getDate();
  const today       = new Date();
  const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    let day, month, year, other = false;
    if (i < firstDay) {
      day = daysInPrev - firstDay + i + 1;
      month = currentMonth === 0 ? 11 : currentMonth - 1;
      year  = currentMonth === 0 ? currentYear - 1 : currentYear;
      other = true;
    } else if (i - firstDay < daysInMonth) {
      day = i - firstDay + 1; month = currentMonth; year = currentYear;
    } else {
      day = i - firstDay - daysInMonth + 1;
      month = currentMonth === 11 ? 0 : currentMonth + 1;
      year  = currentMonth === 11 ? currentYear + 1 : currentYear;
      other = true;
    }
    const dateStr = ds(year, month, day);
    const isToday = !other &&
      today.getDate() === day &&
      today.getMonth() === currentMonth &&
      today.getFullYear() === currentYear;
    cells.push({ day, dateStr, other, isToday });
  }

  const spanEvents   = calendarEvents.filter(e => e.start !== e.end);
  const singleEvents = calendarEvents.filter(e => e.start === e.end);

  // Render week by week
  for (let w = 0; w < totalCells / 7; w++) {
    const week      = cells.slice(w * 7, w * 7 + 7);
    const weekStart = week[0].dateStr;
    const weekEnd   = week[6].dateStr;

    const weekRow = document.createElement('div');
    weekRow.className = 'week-row';

    week.forEach((cell, colIdx) => {
      const cellEl = document.createElement('div');
      let cls = 'day-cell';
      if (cell.other)   cls += ' other-month';
      if (cell.isToday) cls += ' today';
      cellEl.className = cls;

      // Day number
      const numEl = document.createElement('div');
      numEl.className = 'day-number';
      numEl.textContent = cell.day;
      cellEl.appendChild(numEl);

      // Spanning events that cover this cell
      const spansHere = spanEvents.filter(ev =>
        ev.start <= cell.dateStr && ev.end >= cell.dateStr
      );
      spansHere.forEach(ev => {
        const isVisualStart = ev.start >= weekStart ? ev.start === cell.dateStr : colIdx === 0;
        const isVisualEnd   = ev.end   <= weekEnd   ? ev.end   === cell.dateStr : colIdx === 6;

        let spanClass;
        if      (isVisualStart && isVisualEnd)  spanClass = 'span-only';
        else if (isVisualStart)                 spanClass = 'span-start';
        else if (isVisualEnd)                   spanClass = 'span-end';
        else                                    spanClass = 'span-middle';

        const pill = makePill(ev, spanClass);
        // Middle/end: keep a non-breaking space so the pill doesn't collapse
        if (spanClass === 'span-middle' || spanClass === 'span-end') {
          pill.textContent = ' ';
          pill.setAttribute('aria-hidden', 'true');
        }
        cellEl.appendChild(pill);
      });

      // Single-day events
      const dayEvents = singleEvents.filter(e => e.start === cell.dateStr);
      if (dayEvents.length) {
        const list = document.createElement('div');
        list.className = 'events-list';
        dayEvents.forEach(ev => list.appendChild(makePill(ev)));
        cellEl.appendChild(list);
      }

      weekRow.appendChild(cellEl);
    });

    grid.appendChild(weekRow);
  }
}

function makePill(ev, spanClass = '') {
  const pill = document.createElement('div');
  pill.className = `event-pill ${ev.color || 'blue'}${spanClass ? ' ' + spanClass : ''}`;
  pill.textContent = ev.title;
  pill.addEventListener('mouseenter', e => showTooltip(e, ev));
  pill.addEventListener('mouseleave', hideTooltip);
  pill.addEventListener('mousemove',  moveTooltip);
  return pill;
}

function changeMonth(delta) {
  currentMonth += delta;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  if (currentMonth < 0)  { currentMonth = 11; currentYear--; }
  renderCalendar();
}

/* ── Tooltip ─────────────────────────────────────────────────── */
const tooltip = document.getElementById('tooltip');

function showTooltip(e, ev) {
  document.getElementById('tooltip-title').textContent = ev.title;
  document.getElementById('tooltip-body').textContent  = ev.detail || '';
  document.getElementById('tooltip-time').textContent  = ev.time   || '';
  tooltip.setAttribute('aria-hidden', 'false');
  positionTooltip(e);
  tooltip.classList.add('visible');
}

function hideTooltip() {
  tooltip.classList.remove('visible');
  tooltip.setAttribute('aria-hidden', 'true');
}

function moveTooltip(e) { positionTooltip(e); }

function positionTooltip(e) {
  const pad = 14;
  const tw  = tooltip.offsetWidth  || 220;
  const th  = tooltip.offsetHeight || 80;
  let x = e.clientX + pad, y = e.clientY + pad;
  if (x + tw > window.innerWidth  - pad) x = e.clientX - tw - pad;
  if (y + th > window.innerHeight - pad) y = e.clientY - th - pad;
  tooltip.style.left = `${x}px`;
  tooltip.style.top  = `${y}px`;
}

/* ── Shake animation ─────────────────────────────────────────── */
const _s = document.createElement('style');
_s.textContent = `
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
.shake{animation:shake .35s ease;}`;
document.head.appendChild(_s);

/* ── Ambient particles ───────────────────────────────────────── */
(function () {
  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  const COUNT = Math.min(90, Math.round(W * H / 10000));
  const pts = Array.from({ length: COUNT }, () => ({
    x:  Math.random() * W,
    y:  Math.random() * H,
    r:  1.2 + Math.random() * 1.6,
    vx: (Math.random() - 0.5) * 0.48,
    vy: (Math.random() - 0.5) * 0.48,
    a:  0.05 + Math.random() * 0.10
  }));

  const LINK_DIST = 130;

  function frame() {
    ctx.clearRect(0, 0, W, H);

    // Update positions
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x += W; else if (p.x > W) p.x -= W;
      if (p.y < 0) p.y += H; else if (p.y > H) p.y -= H;
    });

    // Draw links between nearby particles
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < LINK_DIST) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(0,102,204,${0.07 * (1 - d / LINK_DIST)})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }

    // Draw dots
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,102,204,${p.a})`;
      ctx.fill();
    });

    requestAnimationFrame(frame);
  }
  frame();
})();

/* ── Boot ────────────────────────────────────────────────────── */
renderCalendar();
document.getElementById('password-input').focus();
