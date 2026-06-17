/* ── Anti-snooping measures ──────────────────────────────────── */
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
  const _check = () => {
    const open = window.outerWidth - window.innerWidth > 160 ||
                 window.outerHeight - window.innerHeight > 160;
    if (open && !_devOpen) {
      _devOpen = true;
      if (document.getElementById('gate').style.display === 'none') lockCalendar();
    } else if (!open) {
      _devOpen = false;
    }
  };
  setInterval(_check, 1000);
})();

/* ── Encrypted calendar data ─────────────────────────────────────
   XOR-encrypted with the password, then base64-encoded.
   To update, run in Node.js:
     function xor(s,k){let o='';for(let i=0;i<s.length;i++)o+=String.fromCharCode(s.charCodeAt(i)^k.charCodeAt(i%k.length));return o;}
     console.log(Buffer.from(xor(JSON.stringify(data),'PASSWORD'),'latin1').toString('base64'));
   ─────────────────────────────────────────────────────────────── */
const ENCRYPTED_BLOB = "PE0EGiVcFhpOVjIUTDQbAB40EFhLXlxbWUN3WUxddRBOSwkCDU1UZV1RXnYfUl9BXVBNQmUbCBgsV0BTTi0FDAEmF0NAYkYLBAlOU00vKwNBCCFLQEVODwYDATVNW04iXhcMTkBLCwszDggAYghAKhkfHQADZy4NDy9TGkkYCQQfAiYbBEwmXRBJJC5LEjM6";

/* ── XOR cipher + base64 ─────────────────────────────────────── */
function xorCipher(str, key) {
  let out = '';
  for (let i = 0; i < str.length; i++)
    out += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  return out;
}

function decryptData(blob, password) {
  try { return xorCipher(atob(blob), password); }
  catch { return null; }
}

/* ── State ───────────────────────────────────────────────────── */
let calendarEvents = []; // array of { start, end, title, color, detail, time }
let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth();

/* ── Password gate ───────────────────────────────────────────── */
function attemptUnlock() {
  const input = document.getElementById('password-input');
  const error = document.getElementById('error-msg');
  const password = input.value;

  if (!password) { shakeInput(input); error.textContent = 'Please enter the access code.'; return; }

  const decrypted = decryptData(ENCRYPTED_BLOB, password);
  let parsed = null;
  try { parsed = JSON.parse(decrypted); } catch {}

  if (!parsed || !Array.isArray(parsed.events)) {
    shakeInput(input);
    error.textContent = 'Incorrect access code. Try again.';
    input.value = '';
    input.focus();
    return;
  }

  calendarEvents = parsed.events;
  document.getElementById('gate').style.display = 'none';
  renderCalendar();
}

function lockCalendar() {
  calendarEvents = [];
  renderCalendar();
  document.getElementById('gate').style.display = '';
  const input = document.getElementById('password-input');
  input.value = '';
  input.focus();
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

function ds(year, month, day) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function renderCalendar() {
  document.getElementById('month-label').textContent =
    `${MONTH_NAMES[currentMonth]} ${currentYear}`;

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  // Weekday header row
  const headerRow = document.createElement('div');
  headerRow.className = 'cal-header';
  WEEKDAYS.forEach(d => {
    const h = document.createElement('div');
    h.className = 'weekday-header';
    h.textContent = d;
    headerRow.appendChild(h);
  });
  grid.appendChild(headerRow);

  // Build full cell list
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
    cells.push({ day, month, year, dateStr, other, isToday });
  }

  // Separate spanning vs single-day events
  const spanEvents   = calendarEvents.filter(e => e.start !== e.end);
  const singleEvents = calendarEvents.filter(e => e.start === e.end);

  // Render week by week
  const numWeeks = totalCells / 7;
  for (let w = 0; w < numWeeks; w++) {
    const week = cells.slice(w * 7, w * 7 + 7);
    const weekStart = week[0].dateStr;
    const weekEnd   = week[6].dateStr;

    // Day-number row
    const weekRow = document.createElement('div');
    weekRow.className = 'week-row';
    week.forEach(cell => {
      const cellEl = document.createElement('div');
      let cls = 'day-cell';
      if (cell.other)   cls += ' other-month';
      if (cell.isToday) cls += ' today';
      cellEl.className = cls;

      const numEl = document.createElement('div');
      numEl.className = 'day-number';
      numEl.textContent = cell.day;
      cellEl.appendChild(numEl);

      // Single-day events for this cell
      const dayEvents = singleEvents.filter(e => e.start === cell.dateStr);
      if (dayEvents.length) {
        const list = document.createElement('div');
        list.className = 'events-list';
        dayEvents.forEach(ev => {
          const pill = makePill(ev);
          list.appendChild(pill);
        });
        cellEl.appendChild(list);
      }

      weekRow.appendChild(cellEl);
    });
    grid.appendChild(weekRow);

    // Spanning events row (only appended if there are spans this week)
    const weekSpans = spanEvents.filter(ev => ev.start <= weekEnd && ev.end >= weekStart);
    if (weekSpans.length) {
      const spansRow = document.createElement('div');
      spansRow.className = 'week-spans';

      weekSpans.forEach(ev => {
        const clampedStart = ev.start < weekStart ? weekStart : ev.start;
        const clampedEnd   = ev.end   > weekEnd   ? weekEnd   : ev.end;

        const startCol = week.findIndex(c => c.dateStr === clampedStart) + 1;
        const endCol   = week.findIndex(c => c.dateStr === clampedEnd)   + 1;

        const pill = makePill(ev, true);
        pill.style.gridColumn = `${startCol} / ${endCol + 1}`;
        if (ev.start < weekStart) pill.classList.add('continues-left');
        if (ev.end   > weekEnd)   pill.classList.add('continues-right');
        spansRow.appendChild(pill);
      });

      grid.appendChild(spansRow);
    }
  }
}

function makePill(ev, spanning = false) {
  const pill = document.createElement('div');
  pill.className = `event-pill ${ev.color || 'blue'}${spanning ? ' spanning' : ''}`;
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
  let x = e.clientX + pad;
  let y = e.clientY + pad;
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

/* ── Boot ────────────────────────────────────────────────────── */
renderCalendar();
document.getElementById('password-input').focus();
