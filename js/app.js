(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const SPOTS = DATA.spots.filter(s => !s.hidden);
  const BYID = {}; DATA.spots.forEach(s => BYID[s.id] = s);
  const THEMES = DATA.THEMES;
  const NAMBA = DATA.origins.namba;
  const SRC = { web:['src_web','src-web'], book:['src_book','src-book'], est:['src_est','src-est'] };
  const sp = (s, f) => L10N.sp(s, f);

  /* ---------- 상태 ---------- */
  const state = { adults: 2, kids: 2, theme: 'all', city: 'all', q: '', day: 'A' };
  try { const s = JSON.parse(localStorage.getItem('osaka-family') || 'null'); if (s) { state.adults = s.adults; state.kids = s.kids; } } catch (e) {}

  const num = n => L10N.num(n);
  const money = n => t('yen', { n: num(n) });
  const yen = n => n === 0 ? t('free') : t('yen', { n: num(n) });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

  /* 난바역 기준 경로 캐시 */
  let nambaPlan = {};
  function calcNamba() { nambaPlan = {}; SPOTS.forEach(s => nambaPlan[s.id] = Router.plan(NAMBA, s)); }

  function chipsHtml(plan) {
    return plan.steps.filter(st => !(st.type === 'walk' && st.min <= 1)).map(st => st.type === 'walk'
      ? `<span class="chip chip-walk">${t('chip_walk', { m: st.min })}</span>`
      : `<span class="chip" style="--c:${st.color}">${esc(t('chip_ride', { line: st.label, m: st.min }))}</span>`).join('');
  }
  function feeHtml(s) {
    if (!s.fee) return `<span class="note">${t('fee_none')}</span>`;
    const f = s.fee, src = f.src ? `<span class="src ${SRC[f.src][1]}">${t(SRC[f.src][0])}</span>` : '';
    if (f.label) return `<b>${esc(sp(s, 'flabel'))}</b><small>${src}</small>`;
    if (f.a === 0 && !f.c) return `<b>${t('free')}</b><small>${src}</small>`;
    const kid = f.c === 0 ? t('fee_kid_free') : t('fee_kid', { y: yen(f.c) });
    return `<b>${t('fee_adult', { y: yen(f.a) })}</b><small>${kid} ${src}</small>`;
  }
  const gmap = (s) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=transit`;

  /* ---------- 가족 입력 ---------- */
  function bindFamily() {
    const fa = $('#fa'), fk = $('#fk');
    fa.value = state.adults; fk.value = state.kids;
    const upd = () => {
      state.adults = Math.max(1, Math.min(9, parseInt(fa.value, 10) || 1));
      state.kids = Math.max(0, Math.min(9, parseInt(fk.value, 10) || 0));
      try { localStorage.setItem('osaka-family', JSON.stringify({ adults: state.adults, kids: state.kids })); } catch (e) {}
      renderDay(); renderTours(); refreshSummary();
    };
    fa.addEventListener('change', upd); fk.addEventListener('change', upd);
  }

  /* ---------- 테마별 목록 ---------- */
  const cityTabsHtml = () => [['all','city_all'],['osaka','city_osaka'],['kyoto','city_kyoto']].map(([v, k]) => `<button class="tab" data-v="${v}">${t(k)}</button>`).join('');
  function themeTabsHtml(withCount) {
    const counts = { all: SPOTS.length };
    Object.keys(THEMES).forEach(k => counts[k] = SPOTS.filter(s => s.theme === k).length);
    const c = k => withCount ? ' ' + counts[k] : '';
    return `<button class="tab" role="tab" data-v="all" style="--c:#101820"><span class="dot"></span>${t('all')}${c('all')}</button>` +
      Object.keys(THEMES).map(k => `<button class="tab" role="tab" data-v="${k}" style="--c:${THEMES[k].color}"><span class="dot"></span>${L10N.th(k)}${c(k)}</button>`).join('');
  }
  function renderTabs() { $('#themeTabs').innerHTML = themeTabsHtml(true); $('#cityTabs').innerHTML = cityTabsHtml(); }
  function bindTabs() {
    $('#themeTabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; state.theme = b.dataset.v; renderSpots(); });
    $('#cityTabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; state.city = b.dataset.v; renderSpots(); });
    $('#q').addEventListener('input', e => { state.q = e.target.value.trim(); renderSpots(); });
  }
  function renderSpots() {
    $$('#themeTabs .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.v === state.theme));
    $$('#cityTabs .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.v === state.city));
    const q = state.q.toLowerCase();
    const list = SPOTS.filter(s => (state.theme === 'all' || s.theme === state.theme) && (state.city === 'all' || s.city === state.city) &&
      (!q || L10N.haystack(s).includes(q)));
    $('#count').textContent = t('count', { n: list.length });
    $('#spots').innerHTML = list.map(s => {
      const T = THEMES[s.theme], p = nambaPlan[s.id];
      const bookTxt = s.book ? t('book_p', { n: s.book }) : '';
      const alt = L10N.cur === 'ja' ? '' : s.ja;
      const more = [
        `<p>${esc(sp(s, 'desc'))}</p>`,
        s.hours ? `<p class="meta">${t('m_hours', { h: esc(sp(s, 'hours')) })}${s.closed ? t('m_closed', { c: esc(sp(s, 'closed')) }) : ''}</p>` : '',
        s.fee && s.fee.note ? `<p class="meta">${t('m_fee', { n: esc(sp(s, 'fnote')) })}</p>` : '',
        s.tip ? `<p class="meta">${t('m_tip', { t: esc(sp(s, 'tip')) })}</p>` : '',
        s.pass ? `<p class="meta">${t('m_pass')}</p>` : '',
        `<div class="links"><a class="btn btn-sm" target="_blank" rel="noopener" href="${gmap(s)}">${t('btn_gmap_short')}</a></div>`
      ].join('');
      return `<article class="spot" id="sp-${s.id}">
        <div class="spot-head" style="--c:${T.color}">
          <span class="bullet" aria-hidden="true">${T.icon}</span>
          <div class="spot-title"><h3>${esc(sp(s, 'name'))}</h3><p class="ja">${alt ? esc(alt) + ' · ' : ''}${esc(sp(s, 'area'))}${bookTxt}</p></div>
          <div class="spot-fee">${feeHtml(s)}</div>
          <div class="spot-route"><div class="chips">${chipsHtml(p)}</div><b>${t('from_namba', { m: p.minutes })}${p.fare ? ' · ' + money(p.fare) : ''}</b></div>
          <div class="spot-act"><button class="btn btn-sm btn-primary" data-go="${s.id}" type="button">${t('btn_go_short')}</button></div>
        </div>
        <details><summary>${t('details')}</summary><div class="more">${more}</div></details>
      </article>`;
    }).join('') || `<p class="note" style="padding:20px 0">${t('no_spot')}</p>`;
  }
  $('#spots').addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    $('#dest').value = b.dataset.go; goRoute(true);
    $('#route').scrollIntoView({ behavior: 'smooth' });
  });

  /* ---------- 지도·애니메이션 ---------- */
  let map, anim, originMarker, destMarker, originPoint = { lat: NAMBA.lat, lng: NAMBA.lng, id: 'namba' };
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initMap() {
    map = L.map('map', { zoomControl: true, scrollWheelZoom: false }).setView([34.67, 135.5], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    SPOTS.forEach(s => {
      const m = L.circleMarker([s.lat, s.lng], { radius: 6, color: '#fff', weight: 2, fillColor: THEMES[s.theme].color, fillOpacity: 1 }).addTo(map);
      m.bindTooltip(() => sp(s, 'name'));
      m.on('click', () => { $('#dest').value = s.id; goRoute(true); });
    });
    map.on('click', e => {
      if ($('#origin').value !== 'pick') return;
      setOrigin({ lat: e.latlng.lat, lng: e.latlng.lng, nameKey: 'pick_name' });
      goRoute(true);
    });
    anim = new Anim(map);
  }

  function Anim(map) {
    this.map = map; this.layer = L.layerGroup().addTo(map); this.t = 0; this.T = 0; this.playing = false; this.speed = 1; this.segs = [];
    this.last = 0; this.onStep = null;
    const self = this;
    this.tick = function (ts) {
      if (!self.playing) return;
      if (!self.last) self.last = ts;
      self.t += (ts - self.last) * self.speed; self.last = ts;
      if (self.t >= self.T) { self.t = self.T; self.playing = false; self.render(); self.ui(); return; }
      self.render(); requestAnimationFrame(self.tick);
    };
  }
  Anim.prototype.load = function (segs, markers) {
    this.layer.clearLayers(); this.segs = segs; let t0 = 0;
    segs.forEach(s => {
      s.start = t0; s.dur = s.type === 'walk' ? 900 + s.min * 70 : 1300 + s.min * 55; t0 += s.dur;
      s.len = []; let c = 0;
      for (let i = 0; i < s.pts.length - 1; i++) { c += Math.hypot(s.pts[i + 1][0] - s.pts[i][0], s.pts[i + 1][1] - s.pts[i][1]); s.len.push(c); }
      s.total = c || 1e-9;
      s.ghost = L.polyline(s.pts, { color: s.color, weight: 4, opacity: .25, dashArray: s.type === 'walk' ? '2 8' : null }).addTo(this.layer);
      s.line = L.polyline([], { color: s.color, weight: s.type === 'walk' ? 4 : 7, opacity: .95, dashArray: s.type === 'walk' ? '2 9' : null, lineCap: 'round' }).addTo(this.layer);
    });
    this.T = t0;
    (markers || []).forEach(m => {
      L.marker([m.lat, m.lng], { icon: L.divIcon({ className: '', html: `<div class="pin ${m.dest ? 'pin-dest' : ''}">${m.label}</div>`, iconSize: [0, 0] }) }).bindTooltip(m.name).addTo(this.layer);
    });
    this.rider = L.marker(segs[0].pts[0], { icon: L.divIcon({ className: '', html: '<div class="rider">🚶</div>', iconSize: [0, 0] }), zIndexOffset: 1000, interactive: false }).addTo(this.layer);
    const all = [].concat(...segs.map(s => s.pts));
    this.map.fitBounds(L.latLngBounds(all), { padding: [40, 40], maxZoom: 15 });
    this.t = 0; this.last = 0;
  };
  Anim.prototype.pointAt = function (s, f) {
    const target = s.total * f; let i = 0;
    while (i < s.len.length - 1 && s.len[i] < target) i++;
    const prevLen = i === 0 ? 0 : s.len[i - 1], segLen = s.len[i] - prevLen || 1e-9;
    const g = Math.min(1, Math.max(0, (target - prevLen) / segLen));
    const a = s.pts[i], b = s.pts[i + 1] || s.pts[i];
    return { pt: [a[0] + (b[0] - a[0]) * g, a[1] + (b[1] - a[1]) * g], i, g };
  };
  Anim.prototype.render = function () {
    let cur = -1;
    this.segs.forEach((s, idx) => {
      const f = Math.min(1, Math.max(0, (this.t - s.start) / s.dur));
      if (f <= 0) { s.line.setLatLngs([]); return; }
      const { pt, i } = this.pointAt(s, f);
      s.line.setLatLngs(s.pts.slice(0, i + 1).concat([pt]));
      if (this.t >= s.start && (this.t < s.start + s.dur || idx === this.segs.length - 1)) cur = idx;
      if (cur === idx) {
        this.rider.setLatLng(pt);
        const el = this.rider.getElement(); if (el) { const r = el.firstChild; r.textContent = s.type === 'walk' ? '🚶' : s.type === 'bus' ? '🚌' : '🚇'; r.style.setProperty('--c', s.color); }
      }
    });
    if (this.onStep) this.onStep(cur, this.t >= this.T);
    const sk = $('#seek'); if (sk && this.T) sk.value = Math.round(this.t / this.T * 1000);
  };
  Anim.prototype.play = function () { if (this.t >= this.T) this.t = 0; this.playing = true; this.last = 0; requestAnimationFrame(this.tick); this.ui(); };
  Anim.prototype.pause = function () { this.playing = false; this.ui(); };
  Anim.prototype.ui = function () { $('#playBtn').textContent = this.playing ? '⏸' : '▶'; };

  /* 계획(plan) → 애니메이션 구간 */
  function toSegs(plan) {
    return plan.steps.map(st => ({ type: st.type, min: st.min, pts: st.pts, color: st.type === 'walk' ? '#566370' : st.color }));
  }

  /* 출발지 선택 */
  function fillSelects() {
    const o = $('#origin');
    const ov = o.value || 'namba', dv = $('#dest').value || 'osakajo';
    o.innerHTML = `<option value="gps">${t('org_gps')}</option>` +
      Object.keys(DATA.origins).map(k => `<option value="${k}">${L10N.org(k)}${k === 'namba' ? ' ★' : ''}</option>`).join('') +
      `<option value="pick">${t('org_pick')}</option>`;
    o.value = ov;
    const d = $('#dest');
    d.innerHTML = Object.keys(THEMES).map(k => `<optgroup label="${L10N.th(k)}">` +
      SPOTS.filter(s => s.theme === k).map(s => `<option value="${s.id}">${esc(sp(s, 'name'))} (${s.city === 'kyoto' ? t('city_kyoto') : t('city_osaka')})</option>`).join('') + '</optgroup>').join('');
    d.value = dv;
  }
  function bindSelects() {
    $('#origin').addEventListener('change', onOriginChange);
    $('#dest').addEventListener('change', () => goRoute(true));
    $('#goBtn').addEventListener('click', () => goRoute(true));
  }
  function setOrigin(p) {
    originPoint = p;
    if (originMarker) map.removeLayer(originMarker);
    originMarker = null;
  }
  function onOriginChange() {
    const v = $('#origin').value, msg = $('#originMsg'); msg.textContent = '';
    if (DATA.origins[v]) { setOrigin(Object.assign({}, DATA.origins[v])); goRoute(true); return; }
    if (v === 'pick') { msg.textContent = t('msg_pick'); return; }
    if (v === 'gps') {
      if (!navigator.geolocation) { msg.textContent = t('msg_nogeo'); fallbackNamba(); return; }
      msg.textContent = t('msg_locating');
      navigator.geolocation.getCurrentPosition(pos => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, nameKey: 'my_loc' };
        const ns = Router.nearestStations(p.lat, p.lng, 1)[0];
        if (ns.km > 6) { msg.textContent = t('msg_far', { km: Math.round(ns.km) }); fallbackNamba(); return; }
        setOrigin(p); msg.textContent = t('msg_here'); goRoute(true);
      }, err => {
        msg.textContent = t('msg_denied'); fallbackNamba();
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    }
  }
  function fallbackNamba() { $('#origin').value = 'namba'; setOrigin(Object.assign({}, NAMBA)); goRoute(true); }

  const originName = () => originPoint.id ? L10N.org(originPoint.id) : t(originPoint.nameKey || 'my_loc');
  let currentPlan = null, currentSteps = [];
  function goRoute(autoplay) {
    const dest = BYID[$('#dest').value]; if (!dest) return;
    const plan = Router.plan(originPoint, dest);
    currentPlan = plan;
    if (plan.outOfArea) $('#originMsg').textContent = t('msg_outofarea');
    const segs = toSegs(plan);
    anim.load(segs, [{ lat: originPoint.lat, lng: originPoint.lng, label: t('pin_start'), name: originName() }, { lat: dest.lat, lng: dest.lng, label: t('pin_dest'), name: sp(dest, 'name'), dest: true }]);
    renderSteps(plan, dest, 'route');
    $('#player').hidden = false;
    $('#gmapBtn').href = `https://www.google.com/maps/dir/?api=1&origin=${originPoint.lat},${originPoint.lng}&destination=${dest.lat},${dest.lng}&travelmode=transit`;
    anim.onStep = (idx, end) => highlight(idx, end);
    summaryContext = { plan };
    refreshSummary();
    if (autoplay && !reduce) anim.play(); else { anim.t = anim.T; anim.render(); anim.ui(); }
  }
  let summaryContext = null;
  function refreshSummary() {
    if (!summaryContext || !summaryContext.plan) return;
    const p = summaryContext.plan, fam = Router.familyFare(p.fare, state.adults, state.kids);
    $('#summary').innerHTML = t('sum_main', { m: p.minutes }) + (p.fare ? t('sum_fare', { f: num(p.fare), a: state.adults, k: state.kids, fam: num(fam) }) : t('sum_nofare')) + `<br><span class="note">${t('sum_note')}</span>`;
  }
  function renderSteps(plan, dest, kind, extraHead) {
    const list = plan.steps.map((st, i) => {
      const c = st.type === 'walk' ? '#9aa6b2' : st.color;
      const text = st.type === 'walk' ? t('step_walk', { from: esc(st.from), to: esc(st.to), m: st.min })
        : t('step_ride', { line: esc(st.label), from: esc(st.from), to: esc(st.to), n: st.n, m: st.min });
      return `<li data-i="${i}" style="--c:${c}"><div>${text}</div></li>`;
    });
    $('#steps').innerHTML = (extraHead || '') + list.join('');
  }
  function highlight(idx, end) {
    $$('#steps li[data-i]').forEach(li => {
      const i = +li.dataset.i;
      li.classList.toggle('on', i === idx && !end); li.classList.toggle('done', i < idx || end);
    });
  }

  /* 일자 코스를 지도에서 재생 */
  function playDay(day) {
    const items = day.items.map(it => BYID[it.id]);
    const pts = [{ pname: t('namba_st'), id: 'namba', lat: NAMBA.lat, lng: NAMBA.lng }].concat(items.map(s => Object.assign({}, s, { pname: sp(s, 'name') })));
    const endNamba = items[items.length - 1].id !== 'kix';
    if (endNamba) pts.push({ pname: t('namba_back'), id: 'namba2', lat: NAMBA.lat, lng: NAMBA.lng, st: [['namba', 1]] });
    const segs = [], markers = []; let allSteps = [], totalMin = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const pl = Router.plan({ lat: a.lat, lng: a.lng }, b.id === 'namba2' || b.id === 'namba' ? Object.assign({}, b, { st: [['namba', 1]] }) : b);
      pl.steps.forEach(s => { s.leg = i; });
      segs.push(...toSegs(pl)); allSteps.push({ head: `${a.pname} → ${b.pname}`, steps: pl.steps, i }); totalMin += pl.minutes;
      markers.push({ lat: b.lat, lng: b.lng, label: i + 1 > items.length ? t('pin_end') : String(i + 1), name: b.pname, dest: i + 1 === items.length && !endNamba });
    }
    markers.unshift({ lat: NAMBA.lat, lng: NAMBA.lng, label: t('pin_start'), name: t('namba_st') });
    anim.load(segs, markers);
    let k = 0;
    $('#steps').innerHTML = allSteps.map(g => `<li class="head" style="--c:#101820"><div><b>${esc(g.head)}</b></div></li>` + g.steps.map(st => {
      const c = st.type === 'walk' ? '#9aa6b2' : st.color, idx = k++;
      const text = st.type === 'walk' ? t('dstep_walk', { m: st.min, from: esc(st.from), to: esc(st.to) }) : t('dstep_ride', { line: esc(st.label), from: esc(st.from), to: esc(st.to), m: st.min });
      return `<li data-i="${idx}" style="--c:${c}"><div>${text}</div></li>`;
    }).join('')).join('');
    $('#player').hidden = false;
    $('#summary').innerHTML = `<b>${esc(L10N.day(day, 'date'))} ${esc(L10N.day(day, 'title'))}</b><br><span class="note">${t('day_sum_note', { m: totalMin })}</span>`;
    summaryContext = null;
    $('#gmapBtn').href = `https://www.google.com/maps/dir/?api=1&origin=${NAMBA.lat},${NAMBA.lng}&destination=${items[items.length - 1].lat},${items[items.length - 1].lng}&travelmode=transit`;
    anim.onStep = (idx, end) => highlight(idx, end);
    $('#route').scrollIntoView({ behavior: 'smooth' });
    if (!reduce) anim.play(); else { anim.t = anim.T; anim.render(); anim.ui(); }
  }

  function bindPlayer() {
    $('#playBtn').addEventListener('click', () => anim.playing ? anim.pause() : anim.play());
    $('#replayBtn').addEventListener('click', () => { anim.t = 0; anim.render(); anim.play(); });
    $('#seek').addEventListener('input', e => { anim.pause(); anim.t = anim.T * (e.target.value / 1000); anim.render(); });
    $('#speed').addEventListener('change', e => { anim.speed = parseFloat(e.target.value); });
  }

  /* ---------- 일자별 코스 ---------- */
  function renderDayTabs() {
    $('#dayTabs').innerHTML = DATA.days.map(d => `<button class="tab" role="tab" data-v="${d.id}" style="--c:${d.color}"><span class="dot">${d.badge}</span>${esc(L10N.day(d, 'date'))}</button>`).join('');
  }
  function bindDayTabs() { $('#dayTabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; state.day = b.dataset.v; renderDay(); }); }
  function dayStats(day) {
    const items = day.items.map(it => BYID[it.id]);
    const pts = [{ lat: NAMBA.lat, lng: NAMBA.lng }].concat(items);
    const endNamba = items[items.length - 1].id !== 'kix';
    if (endNamba) pts.push({ lat: NAMBA.lat, lng: NAMBA.lng });
    const legs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const dest = endNamba && i === pts.length - 2 ? { lat: NAMBA.lat, lng: NAMBA.lng, name: t('namba_st'), st: [['namba', 1]] } : pts[i + 1];
      legs.push(Router.plan({ lat: pts[i].lat, lng: pts[i].lng }, dest));
    }
    let ent = 0, food = 0, transit = 0, adultTransit = 0, passFree = 0;
    items.forEach(s => {
      if (s.theme === 'food') food += Math.round(s.pp * (state.adults + 0.6 * state.kids));
      else if (s.fee) { ent += s.fee.a * state.adults + s.fee.c * state.kids; if (s.pass) passFree += s.fee.a; }
    });
    legs.forEach(l => { transit += Router.familyFare(l.fare, state.adults, state.kids); adultTransit += l.fare; });
    return { items, legs, ent, food, transit, adultTransit, passFree, endNamba };
  }
  function renderDay() {
    $$('#dayTabs .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.v === state.day));
    const day = DATA.days.find(d => d.id === state.day), st = dayStats(day);
    const rows = day.items.map((it, i) => {
      const s = BYID[it.id], T = THEMES[s.theme];
      const leg = st.legs[i];
      const move = `<div class="tl-move"><span>${i === 0 ? t('from_namba_st') : t('move')}</span><span class="chips">${chipsHtml(leg)}</span><span>${t('about_min', { m: leg.minutes })}${leg.fare ? ' · ' + money(leg.fare) : ''}</span></div>`;
      let feeLine = '';
      if (s.id === 'kix') feeLine = `<div class="fee">${t('kix_fee')}</div>`;
      else if (s.fee) feeLine = `<div class="fee">${s.theme === 'food' ? '' : t('fee_entry') + ' '} ${feeHtml(s).replace(/<small>.*?<\/small>/, '')}${s.theme === 'food' ? t('fee_pp', { n: num(s.pp) }) : ''}${s.pass ? t('fee_passfree') : ''}</div>`;
      return `${move}<li class="tl"><div class="tl-time">${it.time}</div><div class="tl-card" style="--c:${T.color}"><h4>${esc(sp(s, 'name'))}</h4><div class="meta">${esc(L10N.dayItem(day, it.id, it.note))}${s.closed ? t('closed_lbl', { c: esc(sp(s, 'closed')) }) : ''}</div>${feeLine}</div></li>`;
    }).join('');
    const last = st.legs[st.legs.length - 1];
    const endMove = st.endNamba ? `<div class="tl-move"><span>${t('back_hotel')}</span><span class="chips">${chipsHtml(last)}</span><span>${t('about_min', { m: last.minutes })}</span></div>` : '';
    const total = st.ent + st.food + st.transit;
    // 주유패스(성인 1인) 손익
    const adultPass = st.passFree + st.adultTransit, PASS = 3500;
    const passBox = (day.id === 'A' || day.id === 'E') ? `<div class="box pass"><h4>${t('pass_h')}</h4><p>${t('pass_none')}</p></div>` :
      `<div class="box pass"><h4>${t('pass_h')}</h4><table><tr><td>${t('pass_free')}</td><td>${money(st.passFree)}</td></tr><tr><td>${t('pass_metro')}</td><td>${money(st.adultTransit)}</td></tr><tr class="total"><td>${adultPass >= PASS ? t('pass_gain') : t('pass_loss')}</td><td>${adultPass >= PASS ? '+' : '−'}${money(Math.abs(adultPass - PASS))}</td></tr></table><p>${t('pass_note')}</p></div>`;
    $('#dayPanel').innerHTML = `<div class="day">
      <div>
        <div class="day-head"><h3>${esc(L10N.day(day, 'date'))} · ${esc(L10N.day(day, 'title'))}</h3><p>${esc(L10N.day(day, 'note'))}</p>
          <div class="route-actions" style="margin-top:12px"><button class="btn btn-primary" id="playDay" type="button">${t('play_day')}</button></div></div>
        <ol class="timeline" style="list-style:none">${rows}${endMove}</ol>
      </div>
      <aside class="cost" aria-label="${t('aria_cost')}">
        <div class="box"><h4>${t('cost_h', { a: state.adults, k: state.kids })}</h4>
          <table><tr><td>${t('cost_ent')}</td><td>${money(st.ent)}</td></tr><tr><td>${t('cost_food')}</td><td>${money(st.food)}</td></tr><tr><td>${t('cost_transit')}</td><td>${money(st.transit)}</td></tr><tr class="total"><td>${t('cost_total')}</td><td>${money(total)}</td></tr></table>
          <p>${t('cost_note')}</p></div>
        ${passBox}
      </aside></div>`;
    $('#playDay').addEventListener('click', () => playDay(day));
  }

  /* ---------- 교토 투어 ---------- */
  function renderTours() {
    const n = state.adults + state.kids, T = DATA.tours, tf = (x, f) => L10N.tour(x, f);
    const krw = v => '₩' + num(v);
    const pickIds = ['t1', 't2', 't3'], colors = ['#019A66', '#522886', '#0079C2'], labels = [t('tour_rank1'), t('tour_rank2'), t('tour_rank3')];
    const picks = pickIds.map((id, i) => {
      const x = T.find(y => y.id === id);
      return `<div class="box" style="--c:${colors[i]}"><span class="rk">${labels[i]}</span><h4>${esc(tf(x, 'name'))}</h4>
        ${x.caution ? `<div class="price">${krw(x.krw)}<small>${t('tour_price_listed')}</small></div><div class="note">${t('tour_price_unknown')}</div>` : `<div class="price">${krw(x.krw)}<small>${t('tour_price_pp')}</small></div><div class="note">${t('tour_price_sum', { n, s: krw(x.krw * n) })}</div>`}
        <p>${esc(tf(x, 'why'))}</p>
        <p class="note">${esc(tf(x, 'stops'))} · ${esc(tf(x, 'time'))}</p>
        ${x.caution ? `<p class="caution">${t('tour_caution', { c: esc(tf(x, 'caution')) })}</p>` : ''}
        <a class="btn btn-sm" target="_blank" rel="noopener" href="${x.url}">${t('tour_page')}</a></div>`;
    }).join('');
    const rows = T.map(x => `<tr><td>${x.rank}</td><td><b>${esc(tf(x, 'name'))}</b><br><span class="note">${esc(tf(x, 'kind'))} · ${esc(tf(x, 'lang'))}</span></td>
      <td class="num">${x.krw ? krw(x.krw) : '$' + x.usd}</td><td>${esc(tf(x, 'rating'))}</td><td>${esc(tf(x, 'stops'))}<br><span class="note">${esc(tf(x, 'time'))}${x.meet ? ' · ' + esc(tf(x, 'meet')) : ''}</span></td><td>${esc(tf(x, 'incl'))}</td><td><span class="note">${esc(tf(x, 'verified'))}</span></td></tr>`).join('');
    const k = BYID.kiyomizu.fee, g = BYID.kinkakuji.fee;
    const entry = state.adults * (k.a + g.a) + state.kids * (k.c + g.c);
    const langNote = t('tour_langnote');
    $('#tourPanel').innerHTML = `
      ${langNote ? `<p class="caution" style="margin-bottom:16px">${langNote}</p>` : ''}
      <div class="pick">${picks}</div>
      <div class="box" style="margin-bottom:24px"><h4>${t('tour_why_h')}</h4>
        <ul class="list">
          <li>${t('tour_why1')}</li><li>${t('tour_why2')}</li><li>${t('tour_why3', { e: num(entry) })}</li><li>${t('tour_why4')}</li>
        </ul></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('th_no')}</th><th>${t('th_product')}</th><th>${t('th_price')}</th><th>${t('th_rating')}</th><th>${t('th_course')}</th><th>${t('th_incl')}</th><th>${t('th_verified')}</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note" style="margin-top:8px">${t('tour_note')}</p>
      <div class="two">
        <div class="box"><h4>${t('diy_h')}</h4><ul class="list"><li>${esc(L10N.diy('transit'))}</li><li>${esc(L10N.diy('fees'))}</li><li>${esc(L10N.diy('note'))}</li></ul>
          <p><a class="btn btn-sm" href="#explore" id="toKyoto">${t('diy_btn')}</a></p></div>
        <div class="box"><h4>${t('check_h')}</h4><ul class="list"><li>${t('check1')}</li><li>${t('check2')}</li><li>${t('check3')}</li><li>${t('check4')}</li></ul></div>
      </div>`;
    const kb = $('#toKyoto'); if (kb) kb.addEventListener('click', () => { state.city = 'kyoto'; state.theme = 'all'; renderSpots(); });
  }

  /* ---------- 정보 ---------- */
  function renderInfo() {
    const LINKS = [
      ['https://kr.trip.com/blog/osakacastle', 'l1'], ['https://www.tsutenkaku.co.jp/annai/index.html', 'l2'], ['https://kr.trip.com/blog/harukas300/', 'l3'],
      ['https://skdesu.com/ko/spend-less-and-explore-more-with-the-osaka-amazing-pass/', 'l4'], ['https://m.waug.com/ko/activities/104876', 'l5'],
      ['https://www.waug.com/ko/themes/835', 'l6'], ['https://www.waug.com/ko/activities/135196', 'l7'], ['https://www.waug.com/ko/activities/152214', 'l8'],
      ['https://www.viator.com/tours/Kyoto/Day-Trip-to-Kyoto-from-Osaka/d332-20415P1', 'l9'],
      ['https://www.klook.com/en-US/activity/87844-fushimi-inoha-shrine-kiyomizu-temple-bus-tour-osaka/', 'l10'],
      ['https://explore.osaka/day-trip-to-kyoto-from-osaka/', 'l11'],
      ['https://www.nippon.com/en/news/yjj2026100100761/kyoto-eyeing-dual-pricing-for-world-heritage-castle.html', 'l12'],
      ['https://wdwnt.com/2026/06/studio-pass-pricing-updated-at-universal-studios-japan-making-early-purchases-more-affordable/', 'l13']];
    $('#infoPanel').innerHTML = `<div class="info-grid">` +
      [1, 2, 3, 4, 5, 6].map(i => `<div class="box"><h4>${t('info' + i + '_h')}</h4><p>${t('info' + i, { web: t('src_web'), book: t('src_book'), est: t('src_est') })}</p></div>`).join('') +
      `</div><div class="srclist"><b>${t('src_h')}</b><br>` +
      LINKS.map(([u, k]) => `<a href="${u}" target="_blank" rel="noopener">${t(k)}</a>`).join('<br>') + `</div>`;
  }

  /* ---------- 룰렛 ---------- */
  const rl = { theme: 'all', city: 'all', free: false, rot: 0, spinning: false, list: [], excluded: new Set() };
  function rlPool() {
    return SPOTS.filter(s => (rl.theme === 'all' || s.theme === rl.theme) && (rl.city === 'all' || s.city === rl.city) &&
      (!rl.free || (s.theme === 'food' ? (s.pp || 0) <= 1500 : (!s.fee || s.fee.a <= 1000))) && !rl.excluded.has(s.id));
  }
  function rlDraw() {
    const cv = $('#rlCanvas'), ctx = cv.getContext('2d'), W = cv.width, R = W / 2, L = rl.list, n = L.length;
    ctx.clearRect(0, 0, W, W);
    if (!n) { ctx.fillStyle = '#566370'; ctx.font = '700 28px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t('rl_empty'), R, R); return; }
    const a = 2 * Math.PI / n;
    L.forEach((s, i) => {
      const a0 = rl.rot + i * a - Math.PI / 2, a1 = a0 + a;
      ctx.beginPath(); ctx.moveTo(R, R); ctx.arc(R, R, R - 4, a0, a1); ctx.closePath();
      ctx.fillStyle = THEMES[s.theme].color; ctx.globalAlpha = i % 2 ? .82 : 1; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
      if (n <= 40) {
        ctx.save(); ctx.translate(R, R); ctx.rotate(a0 + a / 2); ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
        ctx.font = `700 ${n > 24 ? 17 : n > 12 ? 21 : 26}px Pretendard Variable, sans-serif`;
        const nm = sp(s, 'name'), lb = nm.length > 11 ? nm.slice(0, 10) + '…' : nm;
        ctx.fillText(lb, R - 24, 8); ctx.restore();
      }
    });
  }
  function rlRefresh() {
    $$('#rlTheme .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.v === rl.theme));
    $$('#rlCity .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.v === rl.city));
    rl.list = rlPool();
    $('#rlCount').textContent = rl.excluded.size ? t('rl_count_ex', { n: rl.list.length, e: rl.excluded.size }) : t('rl_count', { n: rl.list.length });
    $('#rlSpin').disabled = rl.list.length < 2;
    rlDraw();
  }
  function rlTabs() {
    $('#rlTheme').innerHTML = themeTabsHtml(false);
    $('#rlCity').innerHTML = cityTabsHtml();
  }
  function rlShow() {
    const s = rl.last && BYID[rl.last];
    if (!s) { $('#rlResult').style.borderLeftColor = ''; $('#rlResult').innerHTML = `<p class="note">${t('rl_none')}</p>`; return; }
    const T = THEMES[s.theme], p = nambaPlan[s.id];
    $('#rlResult').style.borderLeftColor = T.color;
    $('#rlResult').innerHTML = `<p class="note">${T.icon} ${L10N.th(s.theme)} · ${s.city === 'kyoto' ? t('city_kyoto') : t('city_osaka')} · ${esc(sp(s, 'area'))}</p><h3>${esc(sp(s, 'name'))}</h3>
      <div class="spot-fee">${feeHtml(s)}</div><div class="chips">${chipsHtml(p)}</div><p><b>${t('from_namba', { m: p.minutes })}${p.fare ? ' · ' + money(p.fare) : ''}</b></p><p class="note">${esc(sp(s, 'desc'))}</p>
      <div class="rl-act"><button class="btn btn-primary" data-rgo="${s.id}" type="button">${t('rl_go')}</button><button class="btn" data-rex="${s.id}" type="button">${t('rl_again')}</button></div>`;
  }
  function rlInit() {
    rlTabs();
    const reset = () => { rl.excluded.clear(); rl.last = null; rlShow(); rlRefresh(); };
    $('#rlTheme').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b && !rl.spinning) { rl.theme = b.dataset.v; reset(); } });
    $('#rlCity').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b && !rl.spinning) { rl.city = b.dataset.v; reset(); } });
    $('#rlFree').addEventListener('change', e => { if (!rl.spinning) { rl.free = e.target.checked; reset(); } else e.target.checked = rl.free; });
    $('#rlSpin').addEventListener('click', rlSpin);
    $('#rlResult').addEventListener('click', e => {
      const g = e.target.closest('[data-rgo]'), x = e.target.closest('[data-rex]');
      if (g) { $('#dest').value = g.dataset.rgo; goRoute(true); $('#route').scrollIntoView({ behavior: 'smooth' }); }
      if (x) { rl.excluded.add(x.dataset.rex); rlRefresh(); rlSpin(); }
    });
    rlShow();
    rlRefresh();
  }
  let actx = null;
  function rlAudio() {
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {}
    return actx;
  }
  function rlTick(f) {
    const c = rlAudio(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = 700 + 500 * f; g.gain.setValueAtTime(.05, c.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .05);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + .06);
  }
  function bell(freq, at, len, vol) {
    const c = actx; if (!c) return;
    [[1, 1], [2.01, .35], [3.02, .15]].forEach(([m, v]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = freq * m;
      g.gain.setValueAtTime(0.0001, c.currentTime + at);
      g.gain.exponentialRampToValueAtTime(vol * v, c.currentTime + at + .01);
      g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + at + len);
      o.connect(g); g.connect(c.destination); o.start(c.currentTime + at); o.stop(c.currentTime + at + len + .05);
    });
  }
  function rlDing() { if (!rlAudio()) return; bell(988, 0, 1.1, .22); bell(740, .45, 1.6, .22); } // 띵~ 동~
  function rlSpin() {
    if (rl.spinning || rl.list.length < 2) return;
    rl.spinning = true; $('#rlSpin').disabled = true; rlAudio(); // 소리는 클릭 직후에 켜야 재생됨
    const n = rl.list.length, a = 2 * Math.PI / n, pick = Math.floor(Math.random() * n);
    // 포인터(맨 위)가 선택 칸의 중앙을 가리키도록: rot + (pick+.5)*a ≡ 0
    const jitter = (Math.random() - .5) * a * .7;
    const base = -((pick + .5) * a) + jitter, start = rl.rot;
    // 속도(rpm): 0초 V0 → 3초 Va → 5초 Vb → 10초 정지. 마지막 구간은 직선 감속,
    // 3~5초 구간의 곡선 지수 q만 조절해서 목표 칸 중앙에 정확히 멈춤
    const V0 = 100, Va = 50, Vb = 15, TA = 3, TB = 2, TC = 5, T = TA + TB + TC;
    const R2 = 2 * Math.PI / 60, K = reduce ? .2 / T : 1;
    const d1 = (V0 + Va) / 2 * R2 * TA, d3 = Vb / 2 * R2 * TC;
    const dmin = (Vb + .1 * (Va - Vb)) * R2 * TB;
    let target = base; while (target < start + d1 + d3 + dmin) target += 2 * Math.PI;
    const d2 = target - start - d1 - d3, avg2 = d2 / (R2 * TB), q = (Va - Vb) / (avg2 - Vb) - 1;
    const dur = T * K * 1000;
    const dist = t => { t = t / K;
      if (t <= TA) return (V0 * t + (Va - V0) / (2 * TA) * t * t) * R2;
      if (t <= TA + TB) { const u = (t - TA) / TB; return d1 + R2 * TB * (Vb * u + (Va - Vb) / (q + 1) * (1 - Math.pow(1 - u, q + 1))); }
      const s = Math.min(TC, t - TA - TB); return d1 + d2 + (Vb * s - Vb / (2 * TC) * s * s) * R2; };
    const speedAt = t => { t = t / K;
      if (t <= TA) return (V0 + (Va - V0) / TA * t) * R2;
      if (t <= TA + TB) return (Vb + (Va - Vb) * Math.pow(1 - (t - TA) / TB, q)) * R2;
      return Vb * Math.max(0, 1 - (t - TA - TB) / TC) * R2; };
    const cv = $('#rlCanvas'), t0 = performance.now(), stage = $('.rl-stage'), ptr = $('.rl-pointer');
    let lastIdx = -1, lastSnd = 0;
    stage.classList.add('spinning');
    const step = now => {
      const t = Math.min(dur / 1000, (now - t0) / 1000), f = t / (dur / 1000);
      rl.rot = start + dist(t); rlDraw();
      cv.style.filter = reduce ? '' : `blur(${Math.min(2.5, speedAt(t) / (2 * Math.PI) * .45).toFixed(2)}px)`; // 빠를수록 흐릿
      const idx = Math.floor((((-rl.rot) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / a);
      if (idx !== lastIdx) {
        if (lastIdx !== -1 && !reduce) { ptr.classList.remove('tick'); void ptr.offsetWidth; ptr.classList.add('tick'); if (now - lastSnd > 45) { rlTick(f); lastSnd = now; } }
        lastIdx = idx;
      }
      if (t < dur / 1000) requestAnimationFrame(step);
      else { rl.rot = target % (2 * Math.PI); stage.classList.remove('spinning'); cv.style.filter = ''; rlDraw(); if (!reduce) rlDing(); rlDone(rl.list[pick]); }
    };
    requestAnimationFrame(step);
  }
  function rlDone(s) {
    rl.spinning = false; $('#rlSpin').disabled = rl.list.length < 2; rl.last = s.id; rlShow();
  }

  /* ---------- 시작 ---------- */
  function rerender() {
    calcNamba();
    renderTabs(); renderSpots(); fillSelects();
    renderDayTabs(); renderDay(); renderTours(); renderInfo();
    rlTabs(); rlShow(); rlRefresh();
    $$('#rlTheme .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.v === rl.theme));
    $$('#rlCity .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.v === rl.city));
    refreshRoute();
  }
  function refreshRoute() {
    goRoute(false);
  }
  i18nInit();
  calcNamba();
  bindFamily(); bindTabs(); renderTabs(); renderSpots();
  fillSelects(); bindSelects(); initMap(); bindPlayer();
  renderDayTabs(); bindDayTabs(); renderDay(); renderTours(); renderInfo(); rlInit();
  goRoute(false); // 첫 화면: 난바 → 오사카성 (자동재생 없음)
  anim.t = 0; anim.render(); anim.ui();
  window.addEventListener('langchange', () => { anim.pause(); rerender(); });
  // 지도 섹션이 화면에 들어오면 한 번만 재생
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); if (!reduce) { anim.t = 0; anim.play(); } } }, { threshold: .45 });
    io.observe($('#map'));
  }
  window.__app = { state, anim, goRoute, playDay };
})();
