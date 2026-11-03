/* ============================================================
   心跳取证 · app
   chroma.js 负责色彩（张力 → LCH 插值），anime.js 负责动效编排
   ============================================================ */

(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var REDUCED = (function () {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  })();
  var CARDS = window.CARDS || [];

  var hhmm = function (d) {
    d = d || new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  };
  var hhmmss = function (d) {
    d = d || new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  };

  /* ---------- 色彩：张力 → 颜色 ---------- */

  var THEMES = {
    day: {
      paper: '#DFE4DE', pen1: '#B93A28', pen2: '#2C5F7C', pen3: '#B8832B',
      warm: '#E8D8CA', heat: ['#2C5F7C', '#B8832B', '#B93A28'], grid: 'dark'
    },
    night: {
      paper: '#151C17', pen1: '#E4573C', pen2: '#5C9EC8', pen3: '#DDA94F',
      warm: '#2B211B', heat: ['#5C9EC8', '#DDA94F', '#E4573C'], grid: 'light'
    }
  };

  var themeName = 'day';
  var T = THEMES.day;
  var heatScale, paperScale;

  function buildScales() {
    heatScale = chroma.scale(T.heat).mode('lch').domain([0, 0.56, 1]);
    paperScale = chroma.scale([T.paper, T.warm]).mode('lch');
  }
  buildScales();

  var rootStyle = document.documentElement.style;
  var elTval = null, elTbar = null, elLed = null;
  var lastPaint = 0, lastTension = 0;

  function paint(t, force) {
    var now = performance.now();
    if (!force && now - lastPaint < 130) return;
    lastPaint = now;
    t = clamp(t, 0, 1);
    lastTension = t;

    var heat = heatScale(t).hex();
    var paper = paperScale(t * 0.14).hex();
    var dark = T.grid === 'dark';
    var base = (dark ? chroma(paper).darken(6) : chroma(paper).brighten(7)).hex();

    rootStyle.setProperty('--heat', heat);
    rootStyle.setProperty('--paper', paper);
    rootStyle.setProperty('--grid', chroma(base).alpha(dark ? 0.085 : 0.055).css());
    rootStyle.setProperty('--grid-major', chroma(base).alpha(dark ? 0.18 : 0.1).css());

    if (elTbar) elTbar.style.transform = 'scaleX(' + t.toFixed(3) + ')';
    if (elTval) {
      elTval.textContent = t.toFixed(2);
      elTval.style.color = t > 0.015 ? heat : '';
    }
    if (elLed) elLed.style.color = heat;
  }

  function applyTheme(name, save) {
    themeName = (name === 'night') ? 'night' : 'day';
    T = THEMES[themeName];
    document.documentElement.setAttribute('data-theme', themeName);
    buildScales();

    var btn = $('#kTheme');
    if (btn) {
      btn.textContent = themeName === 'night' ? '日' : '夜';
      btn.setAttribute('aria-pressed', themeName === 'night' ? 'true' : 'false');
      btn.setAttribute('aria-label', themeName === 'night' ? '切到日间模式' : '切到暗夜模式');
      btn.title = themeName === 'night' ? '切到日间模式' : '切到暗夜模式';
    }

    paint(lastTension, true);
    if (typeof Trace !== 'undefined') Trace.refresh();

    if (save) { try { localStorage.setItem('hb_theme', themeName); } catch (e) {} }
  }

  /* ---------- 波形记录 ---------- */

  var Trace = (function () {
    var cv, ctx, W = 0, H = 0, dpr = 1;
    var bufs = [], t = 0, raf = 0, lastT = 0, live = 0, running = false;
    var spikes = [];
    var CH = [
      { c: 'pen1', y: 0.30, a: 0.155, k: 'gsr' },
      { c: 'pen2', y: 0.55, a: 0.135, k: 'br' },
      { c: 'pen3', y: 0.80, a: 0.115, k: 'pl' }
    ];

    function sample(k, tt, amp) {
      if (k === 'pl') {
        var P = 0.78, b = (((tt % P) + P) % P) / P;
        var notch = Math.exp(-Math.pow((b - 0.3) / 0.07, 2));
        return (Math.exp(-b * 13) - 0.55 * Math.exp(-b * 4.4) + notch * 0.3) * amp * 1.5;
      }
      if (k === 'br') {
        return (Math.sin(tt * 1.15) * 0.9 + Math.sin(tt * 0.47 + 1.2) * 0.3 + Math.sin(tt * 3.1) * 0.05) * amp;
      }
      var v = Math.sin(tt * 0.62 + 0.7) * 0.34 + Math.sin(tt * 1.9 + 2.1) * 0.07;
      for (var i = 0; i < spikes.length; i++) {
        var d = tt - spikes[i].t0;
        if (d >= 0 && d < 12) v += spikes[i].a * (1 - Math.exp(-d * 6.5)) * Math.exp(-d * 1.05);
      }
      return v * amp;
    }

    function render() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = Math.max(1, 1.1 * dpr);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (var c = 0; c < 3; c++) {
        var ch = CH[c], b = bufs[c], cy = H * ch.y, a = H * ch.a;
        ctx.strokeStyle = T[ch.c];
        ctx.globalAlpha = c === 2 ? 0.82 : 0.95;
        ctx.beginPath();
        for (var x = 0; x < W; x++) {
          var y = cy - b[x] * a;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function resize() {
      if (!cv) return;
      var r = cv.getBoundingClientRect();
      if (r.width < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(2, Math.round(r.width * dpr));
      H = Math.max(2, Math.round(r.height * dpr));
      cv.width = W;
      cv.height = H;
      for (var i = 0; i < 3; i++) {
        var old = bufs[i];
        var nb = new Float32Array(W);
        if (old) {
          var n = Math.min(old.length, W);
          nb.set(old.subarray(old.length - n), W - n);
        }
        bufs[i] = nb;
      }
      render();
    }

    function prefill() {
      if (!W || !bufs[0]) return;
      for (var c = 0; c < 3; c++) {
        var b = bufs[c];
        for (var x = 0; x < W; x++) {
          b[x] = sample(CH[c].k, (x - W) / (54 * dpr), 0.5);
        }
      }
      t = 0;
      render();
    }

    function frame(now) {
      if (!running) return;
      if (!bufs[0] || !W) { running = false; return; }
      raf = requestAnimationFrame(frame);
      var dt = lastT ? Math.min(0.06, (now - lastT) / 1000) : 0.016;
      lastT = now;
      t += dt;

      var n = Math.max(1, Math.min(5, Math.round(dt * 54 * dpr)));
      var amp = 0.5 + live * 0.95;

      for (var s = 0; s < n; s++) {
        var tt = t - dt + dt * (s + 1) / n;
        for (var c = 0; c < 3; c++) {
          var b = bufs[c];
          b.copyWithin(0, 1);
          b[W - 1] = sample(CH[c].k, tt, amp);
        }
      }

      while (spikes.length && t - spikes[0].t0 > 14) spikes.shift();
      render();
    }

    return {
      init: function () {
        cv = $('#cv');
        if (!cv) return;
        ctx = cv.getContext('2d');
        if (!ctx) return;
        resize();
        if (REDUCED) {
          if (!W || !bufs[0]) return;
          for (var c = 0; c < 3; c++) {
            var b = bufs[c];
            for (var x = 0; x < W; x++) b[x] = sample(CH[c].k, (x - W) / (54 * dpr) * 2.4, 0.6);
          }
          render();
        }
      },
      resize: resize,
      start: function () {
        if (running || REDUCED) return;
        if (!W || !bufs[0]) resize();
        if (!W || !bufs[0]) return;
        prefill();
        running = true;
        lastT = 0;
        raf = requestAnimationFrame(frame);
      },
      stop: function () {
        running = false;
        cancelAnimationFrame(raf);
      },
      spike: function (a) {
        spikes.push({ t0: t, a: a == null ? 0.9 : a });
        if (spikes.length > 8) spikes.shift();
      },
      setLive: function (v) { live = clamp(v, 0, 1); },
      calm: function () { spikes.length = 0; live = 0; },
      refresh: function () { if (ctx) render(); }
    };
  })();

  /* ---------- 状态 ---------- */

  var S = {
    names: ['你', '他'],
    deck: [], i: 0, turn: 0,
    answered: 0, skipped: 0,
    hes: [], total: 12,
    caseNo: '0000', startedAt: 0,
    reading: false, cur: null,
    cardShownAt: 0,
    timer: null, timerRunning: false,
    endless: false, active: false, drawn: 0, round: 0, seen: []
  };

  /* ---------- 牌库记忆：抽过的不再出现 ---------- */

  function loadSeen() {
    try {
      var a = JSON.parse(localStorage.getItem('hb_seen') || '[]');
      return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string'; }) : [];
    } catch (e) { return []; }
  }

  function saveSeen(arr) {
    try { localStorage.setItem('hb_seen', JSON.stringify(arr)); } catch (e) {}
  }

  function unseenCount(seen) {
    var n = 0;
    for (var i = 0; i < CARDS.length; i++) if (seen.indexOf(CARDS[i].id) < 0) n++;
    return n;
  }

  function updatePool() {
    var seen = loadSeen();
    var left = unseenCount(seen);
    var el = $('#poolInfo');
    if (el) el.textContent = left + ' / ' + CARDS.length + ' 张未抽';
    var r = $('#kReset');
    if (r) r.hidden = left >= CARDS.length;
  }

  function shuffle(a) {
    var arr = a.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function sessionTension() {
    if (!S.hes.length) return 0;
    var sum = 0;
    for (var i = 0; i < S.hes.length; i++) sum += S.hes[i].t;
    return sum / S.hes.length;
  }

  /* ---------- 出牌 ---------- */

  function askeeOf(c) {
    if (c.who === 'both') return '两人各答一次';
    if (c.who === 'random') return '猜拳决定谁答';
    if (c.who === 'partner') return S.names[1 - S.turn];
    return S.names[S.turn];
  }

  function renderCard() {
    var c = S.deck[S.i];
    if (!c) { endSession(); return; }

    S.cur = c;
    S.reading = true;
    S.cardShownAt = performance.now();
    stopTimer();

    var askee = askeeOf(c);
    S.drawn++;
    if (S.seen.indexOf(c.id) < 0) { S.seen.push(c.id); saveSeen(S.seen); }
    $('#prog').textContent = S.endless
      ? pad(S.drawn) + ' · 不限'
      : pad(S.i + 1) + ' / ' + pad(S.deck.length);

    var stage = $('#stage');
    stage.innerHTML =
      '<div class="card">' +
        '<div class="tag"><i></i><span></span></div>' +
        '<p class="statement"></p>' +
        '<div class="foot">' +
          '<div class="frow"><span class="lbl">作答</span><span class="val"></span></div>' +
          (c.alt ? '<div class="frow alt"><span class="lbl">退路</span><span class="val"></span></div>' : '') +
        '</div>' +
      '</div>';

    $('.tag span', stage).textContent = c.title;
    $('.statement', stage).textContent = c.text;
    $('.foot .val', stage).textContent = askee;
    if (c.alt) $('.alt .val', stage).textContent = c.alt;

    var kt = $('#kTimer');
    if (c.dur) {
      kt.hidden = false;
      $('#kTimerSec').textContent = c.dur + 's';
    } else {
      kt.hidden = true;
    }

    stage.scrollTop = 0;

    var card = $('.card', stage);
    var parts = [$('.tag', stage), $('.statement', stage), $('.foot', stage)];

    if (REDUCED) {
      card.style.opacity = 1;
      parts.forEach(function (e) { if (e) e.style.opacity = 1; });
    } else {
      anime.remove(card);
      anime({ targets: card, translateY: [16, 0], opacity: [0, 1], duration: 440, easing: 'easeOutQuart' });
      anime({
        targets: parts, opacity: [0, 1], translateY: [7, 0],
        duration: 420, delay: anime.stagger(75, { start: 90 }), easing: 'easeOutQuad'
      });
    }

    Trace.spike(0.3);
  }

  function answer() {
    if (!S.reading) return;
    S.reading = false;

    var held = (performance.now() - S.cardShownAt) / 1000;
    var tv = clamp((held - 1.5) / 14, 0, 1);

    S.hes.push({ sec: held, t: tv, title: S.cur.title });
    S.answered++;
    S.turn = 1 - S.turn;

    Trace.spike(0.5 + tv * 0.95);
    stampNow();
    paint(sessionTension(), true);

    if (REDUCED) { next(); return; }
    setTimeout(next, 780);
  }

  function skip() {
    if (!S.reading) return;
    S.reading = false;
    S.skipped++;
    S.turn = 1 - S.turn;
    stopTimer();
    Trace.spike(0.16);
    next();
  }

  function next() {
    S.i++;
    if (S.i >= S.deck.length) {
      if (S.endless) {
        saveSeen([]);
        S.seen = [];
        S.deck = shuffle(CARDS);
        S.i = 0;
        S.round++;
        renderCard();
        return;
      }
      endSession();
      return;
    }
    renderCard();
  }

  var stampTimer = 0;

  function stampNow() {
    var st = $('#stamp');
    $('#stamptime').textContent = hhmm();
    clearTimeout(stampTimer);
    if (REDUCED) {
      // 无动效模式下也要按时收走，否则印章会一直压在波形上
      st.style.transform = 'rotate(-7deg)';
      st.style.opacity = 0.82;
      stampTimer = setTimeout(function () { st.style.opacity = 0; }, 620);
      return;
    }
    anime.remove(st);
    anime({ targets: st, opacity: [0, 0.82], scale: [1.55, 1], rotate: [-16, -7], duration: 380, easing: 'easeOutBack' });
    anime({ targets: '#sheet', translateX: [0, -1.6, 1.2, 0], duration: 220, easing: 'linear' });
    stampTimer = setTimeout(function () {
      anime({ targets: st, opacity: 0, duration: 260, easing: 'easeOutQuad' });
    }, 520);
  }

  /* ---------- 计时 ---------- */

  function runTimer() {
    if (!S.cur || !S.cur.dur || S.timerRunning) return;
    var sec = S.cur.dur;
    var fill = $('#tlfill'), txt = $('#tltext');
    var o = { v: 0 };

    S.timerRunning = true;
    $('#timeline').classList.add('on');

    S.timer = anime({
      targets: o, v: 1, duration: sec * 1000, easing: 'linear',
      update: function () {
        fill.style.transform = 'scaleX(' + o.v.toFixed(3) + ')';
        txt.textContent = Math.max(0, sec * (1 - o.v)).toFixed(1) + 's';
      },
      complete: function () {
        txt.textContent = '完成';
        S.timerRunning = false;
        Trace.spike(0.45);
      }
    });
  }

  function stopTimer() {
    if (S.timer) { S.timer.pause(); S.timer = null; }
    S.timerRunning = false;
    var tl = $('#timeline');
    if (tl) tl.classList.remove('on');
    var fill = $('#tlfill');
    if (fill) fill.style.transform = 'scaleX(0)';
  }

  /* ---------- 开局 ---------- */

  function startSession(n) {
    S.seen = loadSeen();
    var avail = CARDS.filter(function (c) { return S.seen.indexOf(c.id) < 0; });
    if (!avail.length) { S.seen = []; saveSeen([]); avail = CARDS.slice(); }

    S.total = n;
    S.endless = (n === -1);
    S.deck = S.endless ? shuffle(avail) : shuffle(avail).slice(0, n || CARDS.length);
    S.i = 0; S.turn = 0; S.drawn = 0; S.round = 0;
    S.answered = 0; S.skipped = 0; S.hes = [];
    S.caseNo = String(1000 + Math.floor(Math.random() * 8999));
    S.startedAt = Date.now();
    S.active = true;

    $('#statusCase').textContent = 'CASE ' + S.caseNo;
    $('#subjects').textContent = S.names[0] + ' / ' + S.names[1];
    $('#kEnd').hidden = !S.endless;

    Trace.calm();
    Trace.start();
    paint(0, true);
    renderCard();
  }

  function endSession() {
    if (!S.active) return;
    S.active = false;
    S.reading = false;
    stopTimer();
    Trace.stop();
    $('#kEnd').hidden = true;
    updatePool();

    var avg = sessionTension();
    var elapsed = Math.max(1, (Date.now() - S.startedAt) / 1000);
    var peak = null;
    for (var i = 0; i < S.hes.length; i++) {
      if (!peak || S.hes[i].sec > peak.sec) peak = S.hes[i];
    }

    $('#rAns').textContent = S.answered;
    $('#rSkip').textContent = S.skipped;
    $('#rTime').textContent = elapsed < 60 ? Math.round(elapsed) + '″' : Math.round(elapsed / 60) + '′';
    $('#rTension').textContent = S.hes.length ? avg.toFixed(2) : '—';
    $('#rPeak').textContent = peak ? peak.sec.toFixed(1) + 's' : '—';
    $('#rPeakTitle').textContent = peak ? '「' + peak.title + '」' : '一次都没犹豫';
    $('#rCase').textContent = 'CASE ' + S.caseNo;

    var peaks = $('#rPeaks');
    peaks.innerHTML = '';
    var top3 = S.hes.slice().sort(function (a, b) { return b.sec - a.sec; }).slice(0, 3);
    var shown = top3.filter(function (x) { return x.sec >= 1.5; });
    if (shown.length) {
      var head = document.createElement('div');
      head.className = 'kv';
      head.innerHTML = '<span class="lbl">最犹豫</span><span class="kvv">回答前停了多久</span>';
      peaks.appendChild(head);
      shown.forEach(function (x, i) {
        var row = document.createElement('div');
        row.className = 'peak';
        var n = document.createElement('b');
        n.className = 'mono';
        n.textContent = pad(i + 1);
        var t = document.createElement('span');
        t.textContent = x.title;
        var v = document.createElement('i');
        v.className = 'mono';
        v.textContent = x.sec.toFixed(1) + 's';
        row.appendChild(n); row.appendChild(t); row.appendChild(v);
        peaks.appendChild(row);
      });
    }
    $('#stampBigTime').textContent = hhmm();

    openReport();
  }

  function openReport() {
    var L = $('#reportLayer');
    L.style.transform = 'translateY(100%)';
    L.hidden = false;

    if (REDUCED) {
      L.style.transform = 'translateY(0%)';
      $('#stampBig').style.opacity = 0.88;
    } else {
      anime({
        targets: L, translateY: ['100%', '0%'], duration: 620, easing: 'easeOutQuart',
        complete: function () {
          anime({ targets: '#stampBig', opacity: [0, 0.88], scale: [1.5, 1], rotate: [-14, -8], duration: 420, easing: 'easeOutBack' });
        }
      });
    }

    if (!REDUCED) {
      roll($('#rAns'), S.answered);
      roll($('#rSkip'), S.skipped);
    }
  }

  function roll(el, to) {
    var o = { v: 0 };
    anime({ targets: o, v: to, duration: 680, easing: 'easeOutExpo', update: function () { el.textContent = Math.round(o.v); } });
  }

  /* ---------- 校准 ---------- */

  function calibrate(done) {
    var btn = $('#kStart');
    btn.disabled = true;
    btn.textContent = '校准中';
    var cal = $('#cal');
    cal.innerHTML = '';

    var lines = ['CH1 皮电 …… 就绪', 'CH2 呼吸 …… 就绪', 'CH3 脉搏 …… 就绪'];
    var i = 0;

    (function step() {
      if (i >= lines.length) {
        setTimeout(function () {
          var L = $('#startLayer');
          if (REDUCED) {
            L.hidden = true;
            btn.disabled = false;
            btn.textContent = '校准并开始';
            done();
            return;
          }
          anime({
            targets: L, translateY: ['0%', '-100%'], duration: 720, easing: 'easeInQuart',
            complete: function () {
              L.hidden = true;
              L.style.transform = 'none';
              btn.disabled = false;
              btn.textContent = '校准并开始';
              done();
            }
          });
        }, 280);
        return;
      }
      var s = document.createElement('span');
      s.innerHTML = '<b>&gt;</b> ' + lines[i];
      cal.appendChild(s);
      if (!REDUCED) anime({ targets: s, opacity: [0, 1], translateX: [-6, 0], duration: 240, easing: 'easeOutQuad' });
      else s.style.opacity = 1;
      i++;
      setTimeout(step, 220);
    })();
  }

  /* ---------- 事件 ---------- */

  function bind() {
    elTval = $('#tval');
    elTbar = $('#tbar');
    elLed = $('#led');

    $('#kAnswer').addEventListener('click', answer);
    $('#kSkip').addEventListener('click', skip);
    $('#kTimer').addEventListener('click', runTimer);
    $('#kEnd').addEventListener('click', function () { if (S.active) endSession(); });

    $('#kTheme').addEventListener('click', function () {
      applyTheme(themeName === 'night' ? 'day' : 'night', true);
    });

    $('#kReset').addEventListener('click', function () {
      saveSeen([]);
      S.seen = [];
      updatePool();
    });

    $('#segTotal').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); });
      S.total = parseInt(b.dataset.n, 10);
    });

    $('#kStart').addEventListener('click', function () {
      var a = ($('#nameA').value || '你').trim().slice(0, 6);
      var b = ($('#nameB').value || '他').trim().slice(0, 6);
      S.names = [a || '你', b || '他'];
      try { localStorage.setItem('hb_names', JSON.stringify(S.names)); } catch (err) {}
      calibrate(function () { startSession(S.total); });
    });

    $('#kAgain').addEventListener('click', function () {
      var L = $('#reportLayer');
      if (REDUCED) {
        L.hidden = true;
        L.style.transform = 'translateY(100%)';
        startSession(S.total);
      } else {
        anime({
          targets: L, translateY: ['0%', '100%'], duration: 460, easing: 'easeInQuart',
          complete: function () {
            L.hidden = true;
            L.style.transform = 'translateY(100%)';
            startSession(S.total);
          }
        });
      }
    });

    $('#kSetup').addEventListener('click', function () {
      var L = $('#reportLayer');
      L.hidden = true;
      L.style.transform = 'translateY(100%)';
      $('#startLayer').hidden = false;
      $('#startLayer').style.transform = 'none';
      $('#cal').innerHTML = '';
      $('#kStart').disabled = false;
      $('#kStart').textContent = '校准并开始';
      Trace.stop();
      Trace.calm();
      paint(0, true);
      updatePool();
    });

    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT') return;
      var onBtn = document.activeElement && document.activeElement.tagName === 'BUTTON';
      var k = e.key.toLowerCase();
      if (k === ' ' || k === 'enter') {
        if (onBtn) return;
        e.preventDefault();
        answer();
      } else if (k === 's') skip();
      else if (k === 't') runTimer();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { Trace.stop(); return; }
      var startHidden = $('#startLayer').hidden;
      var reportHidden = $('#reportLayer').hidden;
      if (startHidden && reportHidden) Trace.start();
    });

    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { Trace.resize(); }, 160);
    });
  }

  /* ---------- 心跳式刷新（犹豫 → 张力） ---------- */

  function tick() {
    if (!S.reading) {
      Trace.setLive(sessionTension());
      return;
    }
    var held = (performance.now() - S.cardShownAt) / 1000;
    var lv = clamp((held - 1) / 11, 0, 1);
    var v = Math.max(sessionTension(), lv * 0.88);
    Trace.setLive(v);
    paint(v, false);
  }

  /* ---------- 启动 ---------- */

  function boot() {
    try {
      var saved = localStorage.getItem('hb_names');
      if (saved) {
        var n = JSON.parse(saved);
        if (n && n[0] && n[1]) {
          $('#nameA').value = n[0];
          $('#nameB').value = n[1];
        }
      }
    } catch (err) {}

    bind();
    Trace.init();

    var savedTheme = null;
    try { savedTheme = localStorage.getItem('hb_theme'); } catch (err) {}
    var prefersDark = false;
    try {
      prefersDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch (err) {}
    applyTheme(
      (savedTheme === 'day' || savedTheme === 'night') ? savedTheme : (prefersDark ? 'night' : 'day'),
      false
    );

    updatePool();
    $('#clock').textContent = hhmmss();
    setInterval(function () { $('#clock').textContent = hhmmss(); }, 1000);
    setInterval(tick, 160);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
