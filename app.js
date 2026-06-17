/* ── Anti-snooping measures ──────────────────────────────────── */
(function () {
  // Block right-click context menu
  document.addEventListener('contextmenu', e => e.preventDefault());

  // Block common devtools shortcuts
  document.addEventListener('keydown', e => {
    const blocked =
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) ||
      (e.ctrlKey && e.key.toUpperCase() === 'U') ||
      (e.metaKey && e.altKey && ['I', 'J'].includes(e.key.toUpperCase())); // macOS
    if (blocked) e.preventDefault();
  });

  // Mild devtools-open detector: clear data if console is open
  let _devOpen = false;
  const _check = () => {
    const threshold = 160;
    if (window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold) {
      if (!_devOpen) { _devOpen = true; _onDevOpen(); }
    } else {
      _devOpen = false;
    }
  };
  const _onDevOpen = () => {
    if (document.getElementById('app') && !document.getElementById('app').hidden) {
      lockCalendar();
    }
  };
  setInterval(_check, 1000);
})();

/* ── Calendar data (XOR-encrypted, base64-encoded) ──────────────
   To update: node -e "
     function xorCipher(s,k){let o='';for(let i=0;i<s.length;i++)o+=String.fromCharCode(s.charCodeAt(i)^k.charCodeAt(i%k.length));return o;}
     console.log(Buffer.from(xorCipher(JSON.stringify(EVENTS),'YOUR_PASSWORD')).toString('base64'));
   "
   Paste the output as ENCRYPTED_BLOB below.
   ──────────────────────────────────────────────────────────────── */
const ENCRYPTED_BLOB = "PE1TXHIET1laQVhaTH00Gk40WxYFCU5TTS8rDA4NOBBOSxgFBApMfU0gACwSBggVTkVNDSgDDh5iCEALABkMTUJlCwQYIVsOS1ZOKhodMwAMTAFeAQYNFEkbCyofDQ00V0IPAx5JJyxlEjxAYgBSW1pBWVlDdllDVhtJQB0FGAUKTH1NIAAjXQMRTkBLGwcqCkNWYnMOBUwICBZMa00CAyxdEEtWTgsDGyJNTU4kVxYIBQBLVUwEGhIYL19CKAAPBg4WZxsEATBeAx0JTA8AHGcnI049b05LXlxbWUN3WUxddxBYMhdOHQYaKwpDVmJzDgoDDRFNQmUbCAElEFhLLQAFTwomFkNAYlENBQMeS1VMJQMUCWIeQA0JGAgGAmVVQy81QRYGAUwoAw0oDhlMNFcPGQANHQpOIQATTAhwQBQxQEtdXnVZTFx2H1NRTlYyFEwzBhUAJRBYSy0ACgAPP01NTjRbDwxOVksuAitPBQ05EE5LDwMFABxlVUMOLEcHS0BODQoaJgYNTnoQIRwfGAYCTgYDAgMhSkIdCQEZAw8zCkEKL0BCIS5OFDJCZV1RXnYfUl9BXVBNVBwUQxgpRg4MTlZLLgIkAAAUYh5AHQUBDE1UZS4NAGBWAxBOQEsMASsAE156EAAFGQlLQ0wjChUNKV5AU04vHBwaKAJBLSxRDQgUTB0KAzcDABglEgQGHkwhLUw6Mhw=";

/* ── Crypto helpers (XOR cipher + base64) ────────────────────── */
function xorCipher(str, key) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

function encryptData(plaintext, password) {
  try { return btoa(unescape(encodeURIComponent(xorCipher(plaintext, password)))); }
  catch { return ''; }
}

function decryptData(blob, password) {
  try { return xorCipher(decodeURIComponent(escape(atob(blob))), password); }
  catch { return null; }
}

/* ── State ───────────────────────────────────────────────────── */
let calendarEvents = {};
let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed

/* ── Password Gate ───────────────────────────────────────────── */
function attemptUnlock() {
  const input = document.getElementById('password-input');
  const error = document.getElementById('error-msg');
  const password = input.value;

  if (!password) {
    shakeInput(input);
    error.textContent = 'Please enter the access code.';
    return;
  }

  const decrypted = decryptData(ENCRYPTED_BLOB, password);
  let parsed = null;
  try { parsed = JSON.parse(decrypted); } catch {}

  if (!parsed || typeof parsed !== 'object') {
    shakeInput(input);
    error.textContent = 'Incorrect access code. Try again.';
    input.value = '';
    input.focus();
    return;
  }

  calendarEvents = parsed;
  document.getElementById('gate').style.display = 'none';
  document.getElementById('app').hidden = false;
  renderCalendar();
}

function lockCalendar() {
  calendarEvents = {};
  document.getElementById('app').hidden = true;
  document.getElementById('gate').style.display = '';
  const input = document.getElementById('password-input');
  input.value = '';
  input.focus();
}

function shakeInput(el) {
  el.classList.remove('shake');
  void el.offsetWidth; // reflow
  el.classList.add('shake');
}

// Allow Enter key on password input
document.getElementById('password-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') attemptUnlock();
});

/* ── Calendar Rendering ──────────────────────────────────────── */
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function renderCalendar() {
  document.getElementById('month-label').textContent =
    `${MONTH_NAMES[currentMonth]} ${currentYear}`;

  const grid = document.getElementById('calendar-grid');
  // Remove day cells (keep weekday headers = first 7 children)
  while (grid.children.length > 7) grid.lastChild.remove();

  const firstDay  = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrev  = new Date(currentYear, currentMonth, 0).getDate();
  const today = new Date();

  let dayCount = 1;
  let nextCount = 1;
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';

    let dateStr, dayNum, isOtherMonth = false;

    if (i < firstDay) {
      dayNum = daysInPrev - firstDay + i + 1;
      const m = currentMonth === 0 ? 11 : currentMonth - 1;
      const y = currentMonth === 0 ? currentYear - 1 : currentYear;
      dateStr = `${y}-${String(m + 1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
      isOtherMonth = true;
    } else if (dayCount <= daysInMonth) {
      dayNum = dayCount++;
      dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
    } else {
      dayNum = nextCount++;
      const m = currentMonth === 11 ? 0 : currentMonth + 1;
      const y = currentMonth === 11 ? currentYear + 1 : currentYear;
      dateStr = `${y}-${String(m + 1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
      isOtherMonth = true;
    }

    if (isOtherMonth) cell.classList.add('other-month');

    const isToday = !isOtherMonth &&
      today.getDate() === dayNum &&
      today.getMonth() === currentMonth &&
      today.getFullYear() === currentYear;
    if (isToday) cell.classList.add('today');

    const numEl = document.createElement('div');
    numEl.className = 'day-number';
    numEl.textContent = dayNum;
    cell.appendChild(numEl);

    const eventsForDay = calendarEvents[dateStr] || [];
    if (eventsForDay.length > 0) {
      const list = document.createElement('div');
      list.className = 'events-list';
      eventsForDay.forEach(ev => {
        const pill = document.createElement('div');
        pill.className = `event-pill ${ev.color || 'blue'}`;
        pill.textContent = ev.title;
        pill.addEventListener('mouseenter', e => showTooltip(e, ev));
        pill.addEventListener('mouseleave', hideTooltip);
        pill.addEventListener('mousemove', moveTooltip);
        list.appendChild(pill);
      });
      cell.appendChild(list);
    }

    grid.appendChild(cell);
  }
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
  const tw = tooltip.offsetWidth  || 220;
  const th = tooltip.offsetHeight || 80;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  if (x + tw > window.innerWidth  - pad) x = e.clientX - tw - pad;
  if (y + th > window.innerHeight - pad) y = e.clientY - th - pad;
  tooltip.style.left = `${x}px`;
  tooltip.style.top  = `${y}px`;
}

/* ── Shake animation (CSS injected) ─────────────────────────── */
const style = document.createElement('style');
style.textContent = `
@keyframes shake {
  0%,100%{transform:translateX(0)}
  20%{transform:translateX(-6px)}
  40%{transform:translateX(6px)}
  60%{transform:translateX(-4px)}
  80%{transform:translateX(4px)}
}
.shake{animation:shake .35s ease;}
`;
document.head.appendChild(style);
