/* =====================================================================
   NEXUS SIGNAL INTELLIGENCE — Demo Simulation
   script.js · vanilla JavaScript, no build step, no backend

   SAFETY NOTE
   This file never reads GPS, never contacts a telecom provider, never
   sends the entered number anywhere, and makes no network requests of
   its own. Every "result" below is preset demo data. The only network
   traffic on the page is the optional Leaflet library and OpenStreetMap
   map tiles for the decorative map.
   ===================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------
     1. CONFIG — all fictional preset data lives here
     ------------------------------------------------------------------ */
  const CONFIG = {
    defaultNumber: '08038254949',
    demoLocation: {
      name: 'Dawanau',
      state: 'Kano State',
      country: 'Nigeria',
      // Approximate area centre, used only to frame the demo map.
      lat: 12.0794,
      lng: 8.4562,
      radiusKm: 5,
    },
    tiles: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    },
    firstSequence: [
      { msg: 'Initializing signal engine.', to: 12, extra: ['nexus-core v4.2.1 · SIMULATION BUILD', 'loading demo modules ............ OK'] },
      { msg: 'Establishing demo connection.', to: 28, extra: ['handshake demo-node-07 :: ACK (simulated)'] },
      { msg: 'Analyzing simulated signal patterns.', to: 52, extra: ['sample frames 2048/2048 · pattern seed 0x5A3F (fictional)'] },
      { msg: 'Processing network information.', to: 74, extra: ['network profile: DEMO-NET-α (preset)'] },
      { msg: 'Loading demonstration map.', to: 92, extra: ['preset demo area: Dawanau, Kano State', 'rendering 5 KM fictional radius'], action: 'prepareMap' },
      { msg: 'Analysis sequence completed.', to: 100, tone: 'ok' },
    ],
    secondSequence: [
      { msg: 'Reconnecting to demo signal.', to: 18, extra: ['re-opening demo channel 07 …'] },
      { msg: 'Rechecking simulated network.', to: 40, extra: ['polling DEMO-NET-α heartbeat …'] },
      { msg: 'Signal instability detected.', to: 58, tone: 'warn', effect: 'unstable', extra: ['packet loss 63% (simulated)', 'jitter threshold exceeded'] },
      { msg: 'Connection interrupted.', to: 71, tone: 'err', effect: 'interrupted', extra: ['heartbeat timeout after 3 retries'] },
      { msg: 'Network unavailable.', to: 71, tone: 'err', effect: 'lost' },
    ],
  };

  /* ------------------------------------------------------------------
     2. ENVIRONMENT
     ------------------------------------------------------------------ */
  const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reducedMotion = () => motionQuery.matches;

  // Optional ?speed=N (1–20) for faster demos / testing.
  const SPEED = (() => {
    const n = Number(new URLSearchParams(window.location.search).get('speed'));
    return Number.isFinite(n) && n > 0 ? Math.min(Math.max(n, 1), 20) : 1;
  })();
  const t = (ms) => (ms / SPEED) * (reducedMotion() ? 0.5 : 1);

  const $ = (id) => document.getElementById(id);
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));

  /* ------------------------------------------------------------------
     3. STATE + cancellation
     ------------------------------------------------------------------ */
  const STAGE = { IDLE: 0, LOCATED: 1, LOST: 2 };
  const state = { stage: STAGE.IDLE, busy: false, runId: 0, progress: 0, number: '' };

  class Cancelled extends Error {}
  const guard = (id) => { if (id !== state.runId) throw new Cancelled(); };
  const wait = (ms, id) => new Promise((resolve) => setTimeout(resolve, t(ms))).then(() => guard(id));

  /* ------------------------------------------------------------------
     4. DOM references
     ------------------------------------------------------------------ */
  const el = {
    body: document.body,
    boot: $('boot'), bootBar: $('bootBar'), bootLine: $('bootLine'),
    clock: $('clock'), soundToggle: $('soundToggle'),
    form: $('analyzeForm'), input: $('phoneInput'), error: $('phoneError'),
    target: $('targetReadout'), targetValue: $('targetValue'),
    analyzeBtn: $('analyzeBtn'), analyzeLabel: $('analyzeLabel'), resetBtn: $('resetBtn'),
    demoStatus: $('demoStatus'), sequenceStep: $('sequenceStep'),
    signalPanel: document.querySelector('.panel--signal'),
    ring: $('progressRing'), ringBar: $('ringBar'), progressValue: $('progressValue'), linearBar: $('linearBar'),
    analysisStatus: $('analysisStatus'), signalBars: $('signalBars'), signalValue: $('signalValue'),
    networkStatus: $('networkStatus'), stepText: $('stepText'), matrix: $('matrixCanvas'),
    mapShell: $('mapShell'), map: $('map'), mapHud: $('mapHud'), mapLost: $('mapLost'), coordText: $('coordText'),
    terminal: $('terminal'),
    alertPanel: $('alertPanel'), alertOk: $('alertOk'), alertBad: $('alertBad'), alertRestartBtn: $('alertRestartBtn'),
    redAlert: $('redAlert'), redAlertBox: $('redAlertBox'), raRestartBtn: $('raRestartBtn'), raCloseBtn: $('raCloseBtn'),
    srLive: $('srLive'),
  };

  /* ------------------------------------------------------------------
     5. UTILITIES
     ------------------------------------------------------------------ */
  function announce(text) {
    el.srLive.textContent = '';
    window.setTimeout(() => { el.srLive.textContent = text; }, 60);
  }

  function setStatus(node, text, tone) {
    node.textContent = text;
    node.className = `status status--${tone}`;
  }

  function timestamp() {
    const d = new Date();
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  }

  /* ------------------------------------------------------------------
     6. VALIDATOR
     ------------------------------------------------------------------ */
  const Validator = {
    validate(raw) {
      const value = String(raw || '').trim();
      if (!value) return { ok: false, error: 'Please enter a phone number to start the demo.' };

      const compact = value.replace(/[\s\-().]/g, '');
      if (!/^\+?\d+$/.test(compact)) {
        return { ok: false, error: 'Use digits only — spaces, dashes and a leading + are allowed.' };
      }
      const digits = compact.replace('+', '');

      if (/^0\d{10}$/.test(compact)) {
        return { ok: true, formatted: `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}` };
      }
      if (/^\+?234\d{10}$/.test(compact)) {
        const local = digits.slice(3);
        return { ok: true, formatted: `+234 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` };
      }
      if (compact.startsWith('0')) {
        return { ok: false, error: 'Nigerian numbers starting with 0 must have 11 digits (e.g. 0803 825 4949).' };
      }
      if (digits.length < 7 || digits.length > 15) {
        return { ok: false, error: 'Enter a number with 7 to 15 digits.' };
      }
      return { ok: true, formatted: compact.startsWith('+') ? compact : `+${digits}` };
    },
  };

  /* ------------------------------------------------------------------
     7. TERMINAL
     ------------------------------------------------------------------ */
  const Terminal = {
    maxLines: 150,

    createLine(tone) {
      const line = document.createElement('div');
      line.className = `t-line t-line--${tone}`;
      const time = document.createElement('span');
      time.className = 't-time';
      time.textContent = `[${timestamp()}]`;
      const msg = document.createElement('span');
      msg.className = 't-msg';
      line.append(time, msg);
      el.terminal.appendChild(line);
      while (el.terminal.children.length > this.maxLines) el.terminal.firstElementChild.remove();
      return msg;
    },

    scroll() { el.terminal.scrollTop = el.terminal.scrollHeight; },

    log(text, tone = 'info') {
      const msg = this.createLine(tone);
      msg.textContent = text;
      this.scroll();
    },

    /** Types text character by character. Stops early (silently) if the run is cancelled. */
    async type(text, tone = 'info', id = state.runId) {
      const msg = this.createLine(tone);
      if (reducedMotion() || SPEED > 4) { msg.textContent = text; this.scroll(); return; }
      msg.classList.add('t-cursor');
      const perChar = t(9);
      for (let i = 1; i <= text.length; i += 2) {
        if (id !== state.runId) { msg.textContent = text; break; }
        msg.textContent = text.slice(0, i + 1);
        this.scroll();
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, perChar));
      }
      msg.classList.remove('t-cursor');
      this.scroll();
    },
  };

  /* ------------------------------------------------------------------
     8. PROGRESS (ring + linear bar)
     ------------------------------------------------------------------ */
  const Progress = {
    circumference: 2 * Math.PI * 52,

    set(value) {
      const v = Math.max(0, Math.min(100, value));
      state.progress = v;
      el.ringBar.style.strokeDashoffset = String(this.circumference * (1 - v / 100));
      el.progressValue.textContent = String(Math.round(v));
      el.ring.setAttribute('aria-valuenow', String(Math.round(v)));
      el.linearBar.style.width = `${v}%`;
    },

    tone(tone) {
      if (tone) el.ring.dataset.tone = tone; else delete el.ring.dataset.tone;
      if (tone === 'bad') el.signalPanel.dataset.tone = 'bad'; else delete el.signalPanel.dataset.tone;
    },

    animateTo(target, duration, id) {
      return new Promise((resolve) => {
        const from = state.progress;
        const total = t(duration);
        if (total <= 16) { this.set(target); resolve(); return; }
        const start = performance.now();
        const frame = (now) => {
          if (id !== state.runId) { resolve(); return; }
          const k = Math.min(1, (now - start) / total);
          const eased = 1 - Math.pow(1 - k, 3);
          this.set(from + (target - from) * eased);
          if (k < 1) requestAnimationFrame(frame); else resolve();
        };
        requestAnimationFrame(frame);
      }).then(() => guard(id));
    },
  };

  /* ------------------------------------------------------------------
     9. SIGNAL METER (fictional values)
     ------------------------------------------------------------------ */
  const Signal = {
    timer: null,

    set(level, dbm, tone = 'ok') {
      [...el.signalBars.children].forEach((bar, i) => bar.classList.toggle('on', i < level));
      el.signalBars.dataset.tone = tone;
      el.signalValue.textContent = dbm === null ? '— dBm' : `${dbm} dBm (sim)`;
    },

    jitter(mode) {
      this.stop();
      if (!mode) return;
      const tick = () => {
        if (mode === 'scan') this.set(randInt(2, 5), -randInt(62, 88), 'ok');
        else if (mode === 'unstable') this.set(randInt(0, 2), -randInt(96, 112), 'warn');
      };
      tick();
      this.timer = window.setInterval(tick, reducedMotion() ? 900 : 240);
    },

    stop() { if (this.timer) { window.clearInterval(this.timer); this.timer = null; } },
  };

  /* ------------------------------------------------------------------
     10. MATRIX RAIN (decorative canvas during scans)
     ------------------------------------------------------------------ */
  const Matrix = {
    raf: null, last: 0, drops: [], ctx: null,
    glyphs: '0123456789ABCDEF<>/\\|=+*#%@$'.split(''),

    start() {
      el.signalPanel.classList.add('is-scanning');
      if (reducedMotion() || !el.matrix.getContext) return;
      this.ctx = el.matrix.getContext('2d');
      // Wait a frame so the canvas has expanded to its scanning height.
      requestAnimationFrame(() => {
        this.resize();
        this.loop(performance.now());
      });
    },

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = el.matrix.clientWidth || 300;
      const h = 92;
      el.matrix.width = Math.round(w * dpr);
      el.matrix.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.cols = Math.ceil(w / 13);
      this.drops = Array.from({ length: this.cols }, () => rand(-12, 0));
      this.w = w; this.h = h;
    },

    loop(now) {
      this.raf = requestAnimationFrame((n) => this.loop(n));
      if (now - this.last < 45) return;
      this.last = now;
      const { ctx } = this;
      ctx.fillStyle = 'rgba(0, 6, 14, 0.22)';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.font = '12px ui-monospace, Menlo, Consolas, monospace';
      for (let i = 0; i < this.drops.length; i += 1) {
        const ch = this.glyphs[randInt(0, this.glyphs.length - 1)];
        const y = this.drops[i] * 13;
        ctx.fillStyle = Math.random() > 0.92 ? '#e0faff' : (Math.random() > 0.5 ? '#22d3ee' : '#34d399');
        ctx.fillText(ch, i * 13, y);
        if (y > this.h && Math.random() > 0.9) this.drops[i] = 0;
        this.drops[i] += 1;
      }
    },

    stop() {
      el.signalPanel.classList.remove('is-scanning');
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      if (this.ctx) this.ctx.clearRect(0, 0, el.matrix.width, el.matrix.height);
    },
  };

  /* ------------------------------------------------------------------
     11. MAP VIEW (Leaflet + OSM, with offline fallback)
     ------------------------------------------------------------------ */
  const MapView = {
    map: null, circle: null, marker: null, fallback: false, tilesLoaded: false, tileErrors: 0,

    get center() { return [CONFIG.demoLocation.lat, CONFIG.demoLocation.lng]; },

    useFallback(reason) {
      if (this.fallback) return;
      this.fallback = true;
      el.mapShell.classList.add('use-fallback');
      Terminal.log(`map engine: ${reason} unavailable — using built-in demo map`, 'warn');
    },

    init() {
      if (this.map || this.fallback) return;
      if (!window.L || typeof window.L.map !== 'function') { this.useFallback('Leaflet library'); return; }
      try {
        this.map = window.L.map(el.map, {
          center: this.center,
          zoom: 11,
          zoomControl: true,
          attributionControl: true,
          dragging: false,
          touchZoom: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
        });
        const tiles = window.L.tileLayer(CONFIG.tiles.url, { maxZoom: 18, attribution: CONFIG.tiles.attribution });
        tiles.on('tileload', () => { this.tilesLoaded = true; });
        tiles.on('tileerror', () => {
          this.tileErrors += 1;
          if (!this.tilesLoaded && this.tileErrors >= 4) this.useFallback('map tiles');
        });
        tiles.addTo(this.map);
      } catch (err) {
        console.warn('[NEXUS] Leaflet init failed:', err);
        this.map = null;
        this.useFallback('Leaflet');
      }
    },

    prepare() {
      this.init();
      el.mapShell.dataset.state = 'scanning';
      if (this.map) this.map.invalidateSize();
    },

    showLocated() {
      const { lat, lng, radiusKm } = CONFIG.demoLocation;
      el.mapShell.dataset.state = 'located';
      el.map.setAttribute('aria-label', `Demonstration map of Dawanau, Kano State, with a fictional ${radiusKm} kilometre radius. Preset demo data — not the location of any phone.`);
      el.coordText.textContent = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E (fictional demo)`;
      el.mapHud.hidden = false;
      el.mapLost.hidden = true;

      if (!this.map) return;
      const L = window.L;
      this.clearLayers();
      this.map.invalidateSize();
      this.circle = L.circle(this.center, {
        radius: radiusKm * 1000,
        color: '#22d3ee', weight: 1.5, dashArray: '6 6',
        fillColor: '#22d3ee', fillOpacity: 0.08,
      }).addTo(this.map);
      const icon = L.divIcon({
        className: 'nx-marker-wrap',
        html: '<div class="nx-marker"><span class="nx-marker__pulse"></span><span class="nx-marker__pulse nx-marker__pulse--2"></span><span class="nx-marker__core"></span></div>',
        iconSize: [26, 26], iconAnchor: [13, 13],
      });
      this.marker = L.marker(this.center, { icon, keyboard: false, interactive: false }).addTo(this.map);
      const bounds = this.circle.getBounds().pad(0.15);
      if (reducedMotion()) this.map.fitBounds(bounds);
      else this.map.flyToBounds(bounds, { duration: 1.4 });
    },

    showLost() {
      el.mapShell.dataset.state = 'lost';
      el.mapLost.hidden = false;
      el.map.setAttribute('aria-label', 'Demonstration map — simulated signal lost.');
      if (this.circle) this.circle.setStyle({ color: '#ff3b5c', fillColor: '#ff3b5c', fillOpacity: 0.05 });
      const m = this.marker && this.marker.getElement();
      if (m) m.classList.add('is-lost');
    },

    clearLayers() {
      if (this.circle) { this.circle.remove(); this.circle = null; }
      if (this.marker) { this.marker.remove(); this.marker = null; }
    },

    reset() {
      el.mapShell.dataset.state = 'idle';
      el.mapHud.hidden = true;
      el.mapLost.hidden = true;
      el.coordText.textContent = '—';
      el.map.setAttribute('aria-label', 'Demonstration map. No location shown yet.');
      this.clearLayers();
      if (this.map) { this.map.stop(); this.map.setView(this.center, 11, { animate: false }); }
    },
  };

  /* ------------------------------------------------------------------
     12. SOUND (Web Audio, off by default, never autoplays)
     ------------------------------------------------------------------ */
  const Sound = {
    enabled: false, ctx: null,

    toggle() {
      this.enabled = !this.enabled;
      if (this.enabled && !this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) { try { this.ctx = new Ctx(); } catch (e) { this.ctx = null; } }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const on = this.enabled;
      el.soundToggle.setAttribute('aria-pressed', String(on));
      el.soundToggle.setAttribute('aria-label', on ? 'Sound effects on. Activate to turn off.' : 'Sound effects off. Activate to turn on.');
      el.soundToggle.querySelector('use').setAttribute('href', on ? '#i-sound-on' : '#i-sound-off');
      el.soundToggle.querySelector('.icon-btn__label').textContent = on ? 'SFX ON' : 'SFX OFF';
      if (on) this.tone(880, 0.07, 'sine', 0.05);
    },

    tone(freq, dur, type = 'sine', vol = 0.04, delay = 0) {
      if (!this.enabled || !this.ctx) return;
      try {
        const start = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(vol, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      } catch (e) { /* audio is optional */ }
    },

    tick() { this.tone(1320, 0.04, 'square', 0.015); },
    success() { this.tone(660, 0.12, 'sine', 0.05); this.tone(990, 0.18, 'sine', 0.05, 0.12); },
    warn() { this.tone(330, 0.16, 'sawtooth', 0.03); },
    error() { this.tone(180, 0.2, 'square', 0.03); },
    alarm() {
      for (let i = 0; i < 4; i += 1) {
        this.tone(880, 0.22, 'sawtooth', 0.04, i * 0.5);
        this.tone(587, 0.22, 'sawtooth', 0.04, i * 0.5 + 0.25);
      }
    },
  };

  /* ------------------------------------------------------------------
     13. RED ALERT (modal) + alert panel
     ------------------------------------------------------------------ */
  const RedAlert = {
    lastFocus: null,

    open() {
      this.lastFocus = document.activeElement;
      el.redAlert.hidden = false;
      el.body.style.overflow = 'hidden';
      window.setTimeout(() => el.raRestartBtn.focus(), 50);
      document.addEventListener('keydown', this.onKey);
    },

    close(restoreFocus = true) {
      if (el.redAlert.hidden) return;
      el.redAlert.hidden = true;
      el.body.style.overflow = '';
      document.removeEventListener('keydown', this.onKey);
      if (restoreFocus && this.lastFocus && typeof this.lastFocus.focus === 'function') this.lastFocus.focus();
    },

    onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); RedAlert.close(); return; }
      if (e.key === 'Tab') {
        const items = [el.raRestartBtn, el.raCloseBtn];
        const idx = items.indexOf(document.activeElement);
        e.preventDefault();
        const next = e.shiftKey ? (idx <= 0 ? items.length - 1 : idx - 1) : (idx + 1) % items.length;
        items[next].focus();
      }
    },
  };

  const AlertPanel = {
    set(mode) {
      el.alertPanel.dataset.state = mode;
      el.alertOk.hidden = mode === 'bad';
      el.alertBad.hidden = mode !== 'bad';
      const p = el.alertOk.querySelector('p');
      const s = el.alertOk.querySelector('small');
      if (mode === 'warn') { p.textContent = 'Instability warning'; s.textContent = 'Simulated signal fluctuating.'; }
      else { p.textContent = 'No active alerts'; s.textContent = 'Simulated link monitoring is idle.'; }
    },
  };

  /* ------------------------------------------------------------------
     14. UI HELPERS
     ------------------------------------------------------------------ */
  const UI = {
    setBusy(busy) {
      state.busy = busy;
      el.analyzeBtn.disabled = busy;
      el.analyzeBtn.classList.toggle('is-busy', busy);
      el.analyzeBtn.setAttribute('aria-busy', String(busy));
      el.input.disabled = busy;
      if (busy) el.analyzeLabel.textContent = 'SCANNING…';
      else this.syncButton();
    },

    syncButton() {
      const modes = {
        [STAGE.IDLE]: ['analyze', 'ANALYZE NUMBER'],
        [STAGE.LOCATED]: ['track', 'TRACK AGAIN'],
        [STAGE.LOST]: ['restart', 'RESTART SIMULATION'],
      };
      const [mode, label] = modes[state.stage];
      el.analyzeBtn.dataset.mode = mode;
      el.analyzeLabel.textContent = label;
      el.input.readOnly = state.stage !== STAGE.IDLE;
    },

    showError(message) {
      el.error.textContent = message;
      el.input.setAttribute('aria-invalid', 'true');
    },

    clearError() {
      el.error.textContent = '';
      el.input.removeAttribute('aria-invalid');
    },

    step(text) { el.stepText.textContent = text; },
  };

  /* ------------------------------------------------------------------
     15. SEQUENCES
     ------------------------------------------------------------------ */
  async function runSteps(steps, id, onEffect) {
    const total = steps.length;
    for (let i = 0; i < total; i += 1) {
      const s = steps[i];
      const tone = s.tone || 'info';
      UI.step(s.msg);
      el.analysisStatus.textContent = s.msg.replace(/\.$/, '');
      if (s.effect && onEffect) onEffect(s.effect);
      if (s.action === 'prepareMap') MapView.prepare();
      if (tone === 'warn') Sound.warn(); else if (tone === 'err') Sound.error(); else Sound.tick();
      // eslint-disable-next-line no-await-in-loop
      await Terminal.type(`[${i + 1}/${total}] ${s.msg}`, tone, id);
      guard(id);
      // eslint-disable-next-line no-await-in-loop
      await Progress.animateTo(s.to, s.to === state.progress ? 300 : rand(700, 1100), id);
      for (const line of s.extra || []) {
        // eslint-disable-next-line no-await-in-loop
        await Terminal.type(`  > ${line}`, 'dim', id);
        // eslint-disable-next-line no-await-in-loop
        await wait(rand(120, 260), id);
      }
      // eslint-disable-next-line no-await-in-loop
      await wait(220, id);
    }
  }

  async function firstSequence(id) {
    Terminal.log('────────── ANALYSIS RUN #1 · DEMO ──────────', 'dim');
    Terminal.log(`target (demo input): ${state.number}`, 'info');
    setStatus(el.demoStatus, 'SCANNING', 'busy');
    el.sequenceStep.textContent = '1 / 2';
    setStatus(el.networkStatus, 'CONNECTING…', 'busy');
    Progress.tone(null);
    Progress.set(0);
    Matrix.start();
    Signal.jitter('scan');
    AlertPanel.set('ok');
    el.mapShell.dataset.state = 'scanning';
    announce('Demo analysis started.');

    await runSteps(CONFIG.firstSequence, id);

    Matrix.stop();
    Signal.stop();
    Signal.set(4, -71, 'ok');
    Progress.tone('ok');
    MapView.showLocated();
    setStatus(el.demoStatus, 'COMPLETE', 'ok');
    setStatus(el.networkStatus, 'DEMO LINK ACTIVE', 'ok');
    el.analysisStatus.textContent = 'Demo analysis complete';
    UI.step('Demonstration map loaded — preset area: Dawanau, Kano State.');
    Terminal.log('demonstration map loaded: Dawanau, Kano State, Nigeria · radius 5 KM (fictional)', 'ok');
    Terminal.log('NOTE: preset demo area only — this is not the location of any phone or number.', 'warn');
    Terminal.log('awaiting next command…', 'dim');
    Sound.success();
    state.stage = STAGE.LOCATED;
    announce('Demo analysis complete. Demonstration map of Dawanau, Kano State loaded. This is preset demo data, not a real location.');
  }

  async function secondSequence(id) {
    Terminal.log('────────── ANALYSIS RUN #2 · DEMO ──────────', 'dim');
    setStatus(el.demoStatus, 'RESCANNING', 'busy');
    el.sequenceStep.textContent = '2 / 2';
    setStatus(el.networkStatus, 'RECONNECTING…', 'busy');
    Progress.tone(null);
    await Progress.animateTo(0, 400, id);
    Matrix.start();
    Signal.jitter('scan');
    announce('Second demo analysis started.');

    await runSteps(CONFIG.secondSequence, id, (effect) => {
      if (effect === 'unstable') {
        Signal.jitter('unstable');
        setStatus(el.networkStatus, 'UNSTABLE', 'warn');
        setStatus(el.demoStatus, 'WARNING', 'warn');
        AlertPanel.set('warn');
      } else if (effect === 'interrupted') {
        Signal.stop();
        Signal.set(1, -118, 'bad');
        Progress.tone('bad');
        setStatus(el.networkStatus, 'INTERRUPTED', 'bad');
      } else if (effect === 'lost') {
        Signal.set(0, null, 'bad');
        setStatus(el.networkStatus, 'UNAVAILABLE', 'bad');
      }
    });

    Matrix.stop();
    MapView.showLost();
    AlertPanel.set('bad');
    setStatus(el.demoStatus, 'SIGNAL LOST', 'bad');
    el.analysisStatus.textContent = 'No network detected';
    UI.step('NO NETWORK DETECTED · SIGNAL LOST');
    Terminal.log('!! NO NETWORK DETECTED — SIGNAL LOST (simulated event)', 'err');
    Terminal.log('!! PLEASE VISIT THE NEAREST OFFICE.', 'err');
    Sound.alarm();
    state.stage = STAGE.LOST;
    RedAlert.open();
    announce('Alert. No network detected. Signal lost. Please visit the nearest office. Demo simulation.');
  }

  async function run(sequence) {
    const id = ++state.runId;
    UI.setBusy(true);
    try {
      await sequence(id);
    } catch (err) {
      if (!(err instanceof Cancelled)) {
        console.error('[NEXUS] simulation error:', err);
        Terminal.log('unexpected simulation error — press RESET to try again.', 'err');
        setStatus(el.demoStatus, 'ERROR', 'bad');
        Matrix.stop();
        Signal.stop();
      }
    } finally {
      if (id === state.runId) UI.setBusy(false);
    }
  }

  /* ------------------------------------------------------------------
     16. CONTROLLER
     ------------------------------------------------------------------ */
  function handleAnalyze(event) {
    if (event) event.preventDefault();
    if (state.busy) return; // prevents overlapping scans

    if (state.stage === STAGE.LOST) { resetSimulation('restart'); return; }

    const result = Validator.validate(el.input.value);
    if (!result.ok) {
      UI.showError(result.error);
      Terminal.log(`input rejected: ${result.error}`, 'err');
      Sound.error();
      el.input.focus();
      return;
    }
    UI.clearError();
    state.number = result.formatted;
    el.targetValue.textContent = result.formatted;
    el.target.hidden = false;

    if (state.stage === STAGE.IDLE) run(firstSequence);
    else if (state.stage === STAGE.LOCATED) run(secondSequence);
  }

  function resetSimulation(reason = 'reset') {
    state.runId += 1; // cancels any running sequence
    state.stage = STAGE.IDLE;
    RedAlert.close(false);
    Matrix.stop();
    Signal.stop();
    Signal.set(0, null, 'ok');
    MapView.reset();
    AlertPanel.set('ok');
    Progress.tone(null);
    Progress.set(0);
    UI.clearError();
    UI.setBusy(false);
    UI.step('System idle.');
    el.target.hidden = true;
    el.targetValue.textContent = '—';
    el.analysisStatus.textContent = 'Awaiting input';
    el.sequenceStep.textContent = '0 / 2';
    setStatus(el.demoStatus, 'STANDBY', 'idle');
    setStatus(el.networkStatus, 'OFFLINE', 'idle');
    Terminal.log(reason === 'restart' ? 'simulation restarted · ready for a new demo run' : 'simulation reset · all demo values cleared', 'ok');
    Sound.tick();
    announce('Simulation reset. Ready.');
    el.input.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------
     17. BOOT + CLOCK
     ------------------------------------------------------------------ */
  function startClock() {
    const update = () => {
      const d = new Date();
      el.clock.textContent = d.toLocaleTimeString([], { hour12: false });
    };
    update();
    window.setInterval(update, 1000);
  }

  function boot() {
    return new Promise((resolve) => {
      const lines = [
        'Loading interface modules…',
        'Calibrating display matrix…',
        'Mounting demo data set…',
        'Simulation environment ready.',
      ];
      const duration = reducedMotion() ? 300 : t(2200);
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.bootBar.style.width = '100%';
        el.boot.classList.add('is-done');
        el.body.classList.remove('is-booting');
        el.body.classList.add('is-ready');
        window.removeEventListener('keydown', finish);
        el.boot.removeEventListener('click', finish);
        window.setTimeout(() => { el.boot.hidden = true; }, 750);
        resolve();
      };
      window.addEventListener('keydown', finish);
      el.boot.addEventListener('click', finish);

      const start = performance.now();
      const frame = (now) => {
        if (done) return;
        const k = Math.min(1, (now - start) / duration);
        el.bootBar.style.width = `${Math.round(k * 100)}%`;
        el.bootLine.textContent = lines[Math.min(lines.length - 1, Math.floor(k * lines.length))];
        if (k < 1) requestAnimationFrame(frame); else window.setTimeout(finish, 200);
      };
      requestAnimationFrame(frame);
      // Safety net in case rAF is throttled (background tab).
      window.setTimeout(finish, duration + 1500);
    });
  }

  /* ------------------------------------------------------------------
     18. INIT
     ------------------------------------------------------------------ */
  function bindEvents() {
    el.form.addEventListener('submit', handleAnalyze);
    el.resetBtn.addEventListener('click', () => resetSimulation('reset'));
    el.alertRestartBtn.addEventListener('click', () => resetSimulation('restart'));
    el.raRestartBtn.addEventListener('click', () => resetSimulation('restart'));
    el.raCloseBtn.addEventListener('click', () => RedAlert.close());
    el.soundToggle.addEventListener('click', () => Sound.toggle());
    el.input.addEventListener('input', () => { if (el.input.getAttribute('aria-invalid')) UI.clearError(); });
    window.addEventListener('resize', () => {
      if (MapView.map) MapView.map.invalidateSize();
      if (Matrix.raf) Matrix.resize();
    });
  }

  async function init() {
    if (!el.input.value) el.input.value = CONFIG.defaultNumber;
    bindEvents();
    startClock();
    Progress.set(0);
    Signal.set(0, null, 'ok');
    UI.syncButton();

    await boot();
    Terminal.log('NEXUS Signal Intelligence · simulation build loaded', 'info');
    Terminal.log('MODE: DEMO SIMULATION — no real data sources are connected', 'warn');
    Terminal.log(window.L ? 'map engine: Leaflet ready (OpenStreetMap tiles)' : 'map engine: built-in demo map', 'dim');
    Terminal.log('awaiting target input…', 'dim');
  }

  window.addEventListener('error', (e) => {
    // Graceful: surface unexpected errors in the terminal instead of failing silently.
    if (el.terminal && e && e.message) Terminal.log(`runtime notice: ${e.message}`, 'err');
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
