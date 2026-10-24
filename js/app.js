(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const SPOTS = DATA.spots.filter(s => !s.hidden);
  const BYID = {}; DATA.spots.forEach(s => BYID[s.id] = s);
  const THEMES = DATA.THEMES;
  const NAMBA = DATA.origins.namba;
  const SRC = { web:['최신 웹 확인','src-web'], book:['책 기재(구판 가능)','src-book'], est:['추정','src-est'] };

  /* ---------- 상태 ---------- */
  const state = { adults: 2, kids: 2, theme: 'all', city: 'all', q: '', day: 'A' };
  try { const s = JSON.parse(localStorage.getItem('osaka-family') || 'null'); if (s) { state.adults = s.adults; state.kids = s.kids; } } catch (e) {}

  const yen = n => n === 0 ? '무료' : Number(n).toLocaleString('ko-KR') + '엔';
  const num = n => Number(n).toLocaleString('ko-KR');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

  /* 난바역 기준 경로 캐시 */
  const nambaPlan = {};
  SPOTS.forEach(s => nambaPlan[s.id] = Router.plan(NAMBA, s));

  function chipsHtml(plan) {
    return plan.steps.filter(st => !(st.type === 'walk' && st.min <= 1)).map(st => st.type === 'walk'
      ? `<span class="chip chip-walk">도보 ${st.min}분</span>`
      : `<span class="chip" style="--c:${st.color}">${esc(st.label)} ${st.min}분</span>`).join('');
  }
  function feeHtml(s) {
    if (!s.fee) return '<span class="note">입장 무료·상점별 상이</span>';
    const f = s.fee, src = f.src ? `<span class="src ${SRC[f.src][1]}">${SRC[f.src][0]}</span>` : '';
    if (f.label) return `<b>${esc(f.label)}</b><small>${src}</small>`;
    if (f.a === 0 && !f.c) return `<b>무료</b><small>${src}</small>`;
    const kid = f.c === 0 ? '어린이 무료' : `어린이 ${yen(f.c)}`;
    return `<b>성인 ${yen(f.a)}</b><small>${kid} ${src}</small>`;
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
  function renderTabs() {
    const counts = { all: SPOTS.length };
    Object.keys(THEMES).forEach(k => counts[k] = SPOTS.filter(s => s.theme === k).length);
    const t = $('#themeTabs');
    t.innerHTML = `<button class="tab" role="tab" data-v="all" style="--c:#101820"><span class="dot"></span>전체 ${counts.all}</button>` +
      Object.keys(THEMES).map(k => `<button class="tab" role="tab" data-v="${k}" style="--c:${THEMES[k].color}"><span class="dot"></span>${THEMES[k].name} ${counts[k]}</button>`).join('');
    $('#cityTabs').innerHTML = [['all','오사카·교토'],['osaka','오사카'],['kyoto','교토']].map(([v, n]) => `<button class="tab" data-v="${v}">${n}</button>`).join('');
    t.addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; state.theme = b.dataset.v; renderSpots(); });
    $('#cityTabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; state.city = b.dataset.v; renderSpots(); });
    $('#q').addEventListener('input', e => { state.q = e.target.value.trim(); renderSpots(); });
  }
  function renderSpots() {
    $$('#themeTabs .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.v === state.theme));
    $$('#cityTabs .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.v === state.city));
    const q = state.q.toLowerCase();
    const list = SPOTS.filter(s => (state.theme === 'all' || s.theme === state.theme) && (state.city === 'all' || s.city === state.city) &&
      (!q || (s.name + s.ja + s.area).toLowerCase().includes(q)));
    $('#count').textContent = `${list.length}곳 · 난바역(메트로) 출발 기준`;
    $('#spots').innerHTML = list.map(s => {
      const T = THEMES[s.theme], p = nambaPlan[s.id];
      const bookTxt = s.book ? ` · 책 p.${s.book}` : '';
      const more = [
        `<p>${esc(s.desc)}</p>`,
        s.hours ? `<p class="meta">운영 시간 ${esc(s.hours)}${s.closed ? ` · 휴무 ${esc(s.closed)}` : ''}</p>` : '',
        s.fee && s.fee.note ? `<p class="meta">요금 참고: ${esc(s.fee.note)}</p>` : '',
        s.tip ? `<p class="meta">팁: ${esc(s.tip)}</p>` : '',
        s.pass ? `<p class="meta">오사카 주유패스 무료 입장 대상(책 기재)</p>` : '',
        `<div class="links"><a class="btn btn-sm" target="_blank" rel="noopener" href="${gmap(s)}">Google 지도</a></div>`
      ].join('');
      return `<article class="spot" id="sp-${s.id}">
        <div class="spot-head" style="--c:${T.color}">
          <span class="bullet" aria-hidden="true">${T.icon}</span>
          <div class="spot-title"><h3>${esc(s.name)}</h3><p class="ja">${esc(s.ja)} · ${esc(s.area)}${bookTxt}</p></div>
          <div class="spot-fee">${feeHtml(s)}</div>
          <div class="spot-route"><div class="chips">${chipsHtml(p)}</div><b>난바에서 약 ${p.minutes}분${p.fare ? ' · ' + num(p.fare) + '엔' : ''}</b></div>
          <div class="spot-act"><button class="btn btn-sm btn-primary" data-go="${s.id}" type="button">길찾기 ▶</button></div>
        </div>
        <details><summary>설명·운영 시간·팁</summary><div class="more">${more}</div></details>
      </article>`;
    }).join('') || '<p class="note" style="padding:20px 0">조건에 맞는 장소가 없습니다. 필터를 바꿔 보세요.</p>';
  }
  $('#spots').addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    $('#dest').value = b.dataset.go; goRoute(true);
    $('#route').scrollIntoView({ behavior: 'smooth' });
  });

  /* ---------- 지도·애니메이션 ---------- */
  let map, anim, originMarker, destMarker, originPoint = { lat: NAMBA.lat, lng: NAMBA.lng, name: NAMBA.name };
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initMap() {
    map = L.map('map', { zoomControl: true, scrollWheelZoom: false }).setView([34.67, 135.5], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    SPOTS.forEach(s => {
      const m = L.circleMarker([s.lat, s.lng], { radius: 6, color: '#fff', weight: 2, fillColor: THEMES[s.theme].color, fillOpacity: 1 }).addTo(map);
      m.bindTooltip(s.name);
      m.on('click', () => { $('#dest').value = s.id; goRoute(true); });
    });
    Object.keys(DATA.stations).forEach(id => {}); // 역 마커는 경로 위에서만 표시
    map.on('click', e => {
      if ($('#origin').value !== 'pick') return;
      setOrigin({ lat: e.latlng.lat, lng: e.latlng.lng, name: '지도에서 고른 위치' });
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
    o.innerHTML = '<option value="gps">내 현재 위치 (GPS)</option>' +
      Object.keys(DATA.origins).map(k => `<option value="${k}">${DATA.origins[k].name}</option>`).join('') +
      '<option value="pick">지도에서 직접 찍기</option>';
    o.value = 'namba';
    const d = $('#dest');
    d.innerHTML = Object.keys(THEMES).map(k => `<optgroup label="${THEMES[k].name}">` +
      SPOTS.filter(s => s.theme === k).map(s => `<option value="${s.id}">${s.name} (${s.city === 'kyoto' ? '교토' : '오사카'})</option>`).join('') + '</optgroup>').join('');
    d.value = 'osakajo';
    o.addEventListener('change', onOriginChange);
    d.addEventListener('change', () => goRoute(true));
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
    if (v === 'pick') { msg.textContent = '지도를 눌러 출발지를 지정하세요. 간사이 지역(약 6km 이내 역 기준) 안에서만 경로를 계산합니다.'; return; }
    if (v === 'gps') {
      if (!navigator.geolocation) { msg.textContent = '이 브라우저는 위치 정보를 지원하지 않아 난바역을 출발지로 사용합니다.'; fallbackNamba(); return; }
      msg.textContent = '현재 위치를 확인하는 중입니다…';
      navigator.geolocation.getCurrentPosition(pos => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, name: '내 현재 위치' };
        const ns = Router.nearestStations(p.lat, p.lng, 1)[0];
        if (ns.km > 6) { msg.textContent = `현재 위치가 간사이 지역에서 멀리 떨어져 있어(가장 가까운 역 ${Math.round(ns.km)}km) 난바역을 출발지로 사용합니다. 도착 후 다시 눌러 보세요.`; fallbackNamba(); return; }
        setOrigin(p); msg.textContent = '현재 위치에서 출발합니다.'; goRoute(true);
      }, err => {
        msg.textContent = '위치 권한을 얻지 못해 난바역을 출발지로 사용합니다. (브라우저에서 위치 접근을 허용하면 현재 위치로 계산됩니다.)'; fallbackNamba();
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    }
  }
  function fallbackNamba() { $('#origin').value = 'namba'; setOrigin(Object.assign({}, NAMBA)); goRoute(true); }

  let currentPlan = null, currentSteps = [];
  function goRoute(autoplay) {
    const dest = BYID[$('#dest').value]; if (!dest) return;
    const plan = Router.plan(originPoint, dest);
    currentPlan = plan;
    if (plan.outOfArea) $('#originMsg').textContent = '출발지 주변에 연결할 역이 없어 도보 직선 경로로 표시합니다.';
    const segs = toSegs(plan);
    anim.load(segs, [{ lat: originPoint.lat, lng: originPoint.lng, label: '출', name: originPoint.name }, { lat: dest.lat, lng: dest.lng, label: '도', name: dest.name, dest: true }]);
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
    $('#summary').innerHTML = `<b>약 ${p.minutes}분</b>${p.fare ? ` · 성인 1인 약 ${num(p.fare)}엔 · 우리 가족(${state.adults}+${state.kids}) 약 ${num(fam)}엔` : ' · 교통비 없음(도보)'}<br><span class="note">대략치입니다. 어린이는 성인의 절반으로 계산했고 대기·환승 시간 변동은 반영하지 않았습니다.</span>`;
  }
  function renderSteps(plan, dest, kind, extraHead) {
    const list = plan.steps.map((st, i) => {
      const c = st.type === 'walk' ? '#9aa6b2' : st.color;
      const text = st.type === 'walk' ? `${st.from} → ${st.to} 도보 <span class="t">${st.min}분</span>`
        : `${esc(st.label)}: ${st.from} → ${st.to} <span class="t">${st.n}정거장 · 약 ${st.min}분</span>`;
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
    const pts = [Object.assign({ name: '난바역', id: 'namba', lat: NAMBA.lat, lng: NAMBA.lng }, {})].concat(items);
    const endNamba = items[items.length - 1].id !== 'kix';
    if (endNamba) pts.push({ name: '난바역(복귀)', id: 'namba2', lat: NAMBA.lat, lng: NAMBA.lng, st: [['namba', 1]] });
    const segs = [], markers = []; let allSteps = [], totalMin = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const pl = Router.plan({ lat: a.lat, lng: a.lng }, b.id === 'namba2' || b.id === 'namba' ? Object.assign({}, b, { st: [['namba', 1]] }) : b);
      pl.steps.forEach(s => { s.leg = i; });
      segs.push(...toSegs(pl)); allSteps.push({ head: `${i === 0 ? '난바역' : a.name} → ${b.name}`, steps: pl.steps, i }); totalMin += pl.minutes;
      markers.push({ lat: b.lat, lng: b.lng, label: i + 1 > items.length ? '끝' : String(i + 1), name: b.name, dest: i + 1 === items.length && !endNamba });
    }
    markers.unshift({ lat: NAMBA.lat, lng: NAMBA.lng, label: '출', name: '난바역' });
    anim.load(segs, markers);
    let k = 0;
    $('#steps').innerHTML = allSteps.map(g => `<li class="head" style="--c:#101820"><div><b>${esc(g.head)}</b></div></li>` + g.steps.map(st => {
      const c = st.type === 'walk' ? '#9aa6b2' : st.color, idx = k++;
      const text = st.type === 'walk' ? `도보 ${st.min}분 <span class="t">${st.from} → ${st.to}</span>` : `${esc(st.label)} <span class="t">${st.from} → ${st.to} · ${st.min}분</span>`;
      return `<li data-i="${idx}" style="--c:${c}"><div>${text}</div></li>`;
    }).join('')).join('');
    $('#player').hidden = false;
    $('#summary').innerHTML = `<b>${esc(day.date)} ${esc(day.title)}</b><br><span class="note">이동만 약 ${totalMin}분(대략). 장소 사이 대기·관람 시간은 포함하지 않았습니다.</span>`;
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
    $('#dayTabs').innerHTML = DATA.days.map(d => `<button class="tab" role="tab" data-v="${d.id}" style="--c:${d.color}"><span class="dot">${d.badge}</span>${esc(d.date)}</button>`).join('');
    $('#dayTabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; state.day = b.dataset.v; renderDay(); });
  }
  function dayStats(day) {
    const items = day.items.map(it => BYID[it.id]);
    const pts = [{ lat: NAMBA.lat, lng: NAMBA.lng }].concat(items);
    const endNamba = items[items.length - 1].id !== 'kix';
    if (endNamba) pts.push({ lat: NAMBA.lat, lng: NAMBA.lng });
    const legs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const dest = endNamba && i === pts.length - 2 ? { lat: NAMBA.lat, lng: NAMBA.lng, name: '난바역', st: [['namba', 1]] } : pts[i + 1];
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
      const move = `<div class="tl-move"><span>${i === 0 ? '난바역에서' : '이동'}</span><span class="chips">${chipsHtml(leg)}</span><span>약 ${leg.minutes}분${leg.fare ? ' · ' + num(leg.fare) + '엔' : ''}</span></div>`;
      let feeLine = '';
      if (s.id === 'kix') feeLine = `<div class="fee">난카이 공항급행 약 45분 · 1인 970엔(라피트 특급 이용 시 추가 요금)</div>`;
      else if (s.fee) feeLine = `<div class="fee">${s.theme === 'food' ? '' : '입장 '} ${feeHtml(s).replace(/<small>.*?<\/small>/, '')}${s.theme === 'food' ? ` (1인 약 ${num(s.pp)}엔)` : ''}${s.pass ? ' · 주유패스 무료' : ''}</div>`;
      return `${move}<li class="tl"><div class="tl-time">${it.time}</div><div class="tl-card" style="--c:${T.color}"><h4>${esc(s.name)}</h4><div class="meta">${esc(it.note)}${s.closed ? ` · 휴무 ${esc(s.closed)}` : ''}</div>${feeLine}</div></li>`;
    }).join('');
    const last = st.legs[st.legs.length - 1];
    const endMove = st.endNamba ? `<div class="tl-move"><span>숙소 방향 복귀</span><span class="chips">${chipsHtml(last)}</span><span>약 ${last.minutes}분</span></div>` : '';
    const total = st.ent + st.food + st.transit;
    // 주유패스(성인 1인) 손익
    const adultPass = st.passFree + st.adultTransit, PASS = 3500;
    const passBox = (day.id === 'A' || day.id === 'E') ? `<div class="box pass"><h4>오사카 주유패스(1일권 3,500엔)</h4><p>이 코스는 무료 입장 대상이 거의 없어 패스를 쓸 이유가 적습니다.</p></div>` :
      `<div class="box pass"><h4>오사카 주유패스(1일권 3,500엔)</h4><table><tr><td>무료 입장 대상 합계(성인 1인)</td><td>${num(st.passFree)}엔</td></tr><tr><td>메트로 교통비(성인 1인, 추정)</td><td>${num(st.adultTransit)}엔</td></tr><tr class="total"><td>${adultPass >= PASS ? '패스가 이득' : '패스가 손해'}</td><td>${adultPass >= PASS ? '+' : '−'}${num(Math.abs(adultPass - PASS))}엔</td></tr></table><p>성인 1인 기준입니다. 어린이는 무료 입장이 많아 패스 효과가 작고, 패스 어린이 요금은 별도 확인이 필요합니다. JR(USJ 등)은 패스로 탈 수 없습니다.</p></div>`;
    $('#dayPanel').innerHTML = `<div class="day">
      <div>
        <div class="day-head"><h3>${esc(day.date)} · ${esc(day.title)}</h3><p>${esc(day.note)}</p>
          <div class="route-actions" style="margin-top:12px"><button class="btn btn-primary" id="playDay" type="button">지도에서 코스 재생 ▶</button></div></div>
        <ol class="timeline" style="list-style:none">${rows}${endMove}</ol>
      </div>
      <aside class="cost" aria-label="비용 요약">
        <div class="box"><h4>우리 가족(${state.adults}+${state.kids}) 예상 비용</h4>
          <table><tr><td>입장료</td><td>${num(st.ent)}엔</td></tr><tr><td>식사(어린이 60% 가정)</td><td>${num(st.food)}엔</td></tr><tr><td>교통(대략)</td><td>${num(st.transit)}엔</td></tr><tr class="total"><td>합계</td><td>${num(total)}엔</td></tr></table>
          <p>식사는 코스에 넣은 식당 기준이며 그 외 간식·음료는 제외입니다. 책 기재 가격은 구판일 수 있어 약간 달라질 수 있습니다.</p></div>
        ${passBox}
      </aside></div>`;
    $('#playDay').addEventListener('click', () => playDay(day));
  }

  /* ---------- 교토 투어 ---------- */
  function renderTours() {
    const n = state.adults + state.kids, T = DATA.tours;
    const krw = v => '₩' + num(v);
    const pickIds = ['t1', 't2', 't3'], colors = ['#019A66', '#522886', '#0079C2'], labels = ['가성비 1순위', '편의·사진 2순위', '프라이빗 3순위(확인 필요)'];
    const picks = pickIds.map((id, i) => {
      const t = T.find(x => x.id === id);
      return `<div class="box" style="--c:${colors[i]}"><span class="rk">${labels[i]}</span><h4>${esc(t.name)}</h4>
        ${t.caution ? `<div class="price">${krw(t.krw)}<small> 표기가격</small></div><div class="note">차량 기준/1인 기준 미확인 — 합계는 계산하지 않았습니다</div>` : `<div class="price">${krw(t.krw)}<small> / 1인(성인)</small></div><div class="note">${n}명 합계 약 ${krw(t.krw * n)} (성인 요금 기준 상한)</div>`}
        <p>${esc(t.why)}</p>
        <p class="note">${esc(t.stops)} · ${esc(t.time)}</p>
        ${t.caution ? `<p class="caution">주의: ${esc(t.caution)}</p>` : ''}
        <a class="btn btn-sm" target="_blank" rel="noopener" href="${t.url}">상품 페이지</a></div>`;
    }).join('');
    const rows = T.map(t => `<tr><td>${t.rank}</td><td><b>${esc(t.name)}</b><br><span class="note">${esc(t.kind)} · ${esc(t.lang)}</span></td>
      <td class="num">${t.krw ? krw(t.krw) : '$' + t.usd}</td><td>${esc(t.rating)}</td><td>${esc(t.stops)}<br><span class="note">${esc(t.time)}${t.meet ? ' · ' + esc(t.meet) : ''}</span></td><td>${esc(t.incl)}</td><td><span class="note">${esc(t.verified)}</span></td></tr>`).join('');
    const k = BYID.kiyomizu.fee, g = BYID.kinkakuji.fee;
    const entry = state.adults * (k.a + g.a) + state.kids * (k.c + g.c);
    $('#tourPanel').innerHTML = `
      <div class="pick">${picks}</div>
      <div class="box" style="margin-bottom:24px"><h4>추천 이유</h4>
        <ul class="list">
          <li>평일(금요일)이고 아이가 함께라면, 한국어로 진행되는 버스 투어가 환승·길 찾기 부담이 가장 적습니다. <b>아이트립</b>은 후기 340건 평점 5.0이라 안정적이고, 난바 인근에서 모이고 끝나는 <b>유투어버스</b>는 숙소가 난바라면 동선이 편합니다.</li>
          <li>프라이빗 차량은 아이 컨디션에 맞춰 일정을 줄일 수 있어 4인 가족에게 이상적이지만, 상품 페이지에 <b>가격이 차량 기준인지 1인 기준인지</b> 표기가 없습니다. 예약 전에 반드시 문의하세요.</li>
          <li>입장료는 대부분 별도입니다. 기요미즈데라·킨카쿠지 입장료만 우리 가족 약 <b>${num(entry)}엔</b>(책·웹 기준 성인/어린이 요금)이고, 점심도 별도입니다.</li>
          <li>10월 말은 교토 단풍이 아직 이른 시기라 혼잡도는 11월 중순보다 낮은 편이지만, 주요 사찰 앞은 평일에도 붐빕니다. 일정이 10시간 안팎이므로 간식·물·접이식 우산을 준비하세요.</li>
        </ul></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>상품</th><th>1인 가격</th><th>평점</th><th>코스·시간</th><th>입장료·포함</th><th>확인 방법</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note" style="margin-top:8px">가격은 2026-10-23 조회 기준이며 날짜·환율에 따라 달라집니다. 상품 목록 가운데 "상품 페이지 직접 확인"으로 표시한 것만 상세 내용을 읽고 정리했고, 나머지는 목록 정보만 확인했습니다. 어린이 요금은 상품마다 달라 예약 화면에서 확인해야 합니다.</p>
      <div class="two">
        <div class="box"><h4>투어 없이 자유여행으로 가면</h4><ul class="list"><li>${esc(DATA.kyotoDIY.transit)}</li><li>${esc(DATA.kyotoDIY.fees)}</li><li>${esc(DATA.kyotoDIY.note)}</li></ul>
          <p><a class="btn btn-sm" href="#explore" id="toKyoto">교토 명소 목록 보기</a></p></div>
        <div class="box"><h4>예약 전에 확인할 것</h4><ul class="list"><li>어린이 요금과 나이 기준(만 몇 세부터 좌석·식사 필요한지)</li><li>집합 장소·시간(난바 도톤보리 쪽인지, 호텔 픽업인지)과 종료 장소</li><li>입장료·점심 포함 여부, 취소 규정(프라이빗은 3일 전까지 환불인 곳도 있음)</li><li>10/30 일기예보 확인 후 우천 시 변경 가능 여부</li></ul></div>
      </div>`;
    const kb = $('#toKyoto'); if (kb) kb.addEventListener('click', () => { state.city = 'kyoto'; state.theme = 'all'; renderSpots(); });
  }

  /* ---------- 정보 ---------- */
  function renderInfo() {
    $('#infoPanel').innerHTML = `<div class="info-grid">
      <div class="box"><h4>요금 표시 읽는 법</h4><p><span class="src src-web">최신 웹 확인</span> 2026-10 웹 페이지에서 확인한 값. <span class="src src-book">책 기재(구판 가능)</span> 책에 인쇄된 값으로 현재와 다를 수 있음(예: 오사카성 천수각 책 600엔 → 웹 1,200엔). <span class="src src-est">추정</span> 확인하지 못한 값. 방문 전 공식 안내를 꼭 확인하세요.</p></div>
      <div class="box"><h4>교통 카드·패스</h4><p>ICOCA 같은 교통 IC 카드는 메트로·JR·사철 모두에 쓸 수 있어 가장 편합니다. 오사카 주유패스(2026년 기준 1일 3,500엔·2일 5,000엔)는 코스에 따라 이득이 갈리므로, 일자별 코스의 비용 칸에서 날마다 손익을 확인하세요. 메트로 1일 승차권(Enjoy Eco Card)은 평일 820엔, 주말·공휴일 620엔입니다.</p></div>
      <div class="box"><h4>난바에서 공항·교토 가는 법</h4><p>간사이공항: 난카이 난바역에서 공항급행 약 45분, 970엔. 교토: 메트로로 우메다(약 240엔) → 한큐로 가와라마치(약 410엔), 약 70분. 유니버설 스튜디오: JR만 가능하며 난바역에서 JR 난바 또는 우메다 경유로 약 45분.</p></div>
      <div class="box"><h4>날짜별 주의</h4><p>10/31(토)은 할로윈 주말이라 우메다·도톤보리가 매우 붐빕니다. 11/1(일)은 가이유칸·USJ가 혼잡합니다. 11/2(월)은 월요일 휴무 시설이 있어 코스에서 제외했습니다. 컵누들 뮤지엄과 오사카 주택박물관은 화요일 휴관입니다.</p></div>
      <div class="box"><h4>교토 입장료 인상 소식</h4><p>니조성은 2027 회계연도부터 시 외 방문객 요금을 2,000엔으로 올리는 방안이 2026-10-01 발표되었습니다(현재는 1,300엔). 이번 일정에는 포함하지 않았습니다.</p></div>
      <div class="box"><h4>경로 애니메이션 한계</h4><p>역 그래프(약 70개 역)로 계산한 간이 경로입니다. 급행 정차·실시간 운행·막차는 반영하지 않았습니다. 확정 이동은 Google 지도 버튼으로 시간표를 확인하세요.</p></div>
    </div>
    <div class="srclist"><b>웹 조사 출처</b><br>
      <a href="https://kr.trip.com/blog/osakacastle" target="_blank" rel="noopener">트립닷컴 오사카성 가이드(천수각 요금)</a><br>
      <a href="https://www.tsutenkaku.co.jp/annai/index.html" target="_blank" rel="noopener">츠텐카쿠 공식(요금·시간)</a><br>
      <a href="https://kr.trip.com/blog/harukas300/" target="_blank" rel="noopener">트립닷컴 하루카스 300(2026 요금)</a><br>
      <a href="https://skdesu.com/ko/spend-less-and-explore-more-with-the-osaka-amazing-pass/" target="_blank" rel="noopener">오사카 주유패스 2026 정리</a><br>
      <a href="https://m.waug.com/ko/activities/104876" target="_blank" rel="noopener">WAUG 유투어버스 교토 투어</a><br>
      <a href="https://www.waug.com/ko/themes/835" target="_blank" rel="noopener">WAUG 교토 일일 버스투어 목록</a><br>
      <a href="https://www.waug.com/ko/activities/135196" target="_blank" rel="noopener">WAUG 교토 고급 밴 단독 투어</a><br>
      <a href="https://www.waug.com/ko/activities/152214" target="_blank" rel="noopener">WAUG 교토 VIP 프라이빗 투어</a><br>
      <a href="https://www.viator.com/tours/Kyoto/Day-Trip-to-Kyoto-from-Osaka/d332-20415P1" target="_blank" rel="noopener">Viator 교토 일일투어</a><br>
      <a href="https://www.klook.com/en-US/activity/87844-fushimi-inoha-shrine-kiyomizu-temple-bus-tour-osaka/" target="_blank" rel="noopener">Klook 교토 일일투어</a><br>
      <a href="https://explore.osaka/day-trip-to-kyoto-from-osaka/" target="_blank" rel="noopener">오사카→교토 교통 요금 가이드</a><br>
      <a href="https://www.nippon.com/en/news/yjj2026100100761/kyoto-eyeing-dual-pricing-for-world-heritage-castle.html" target="_blank" rel="noopener">nippon.com 니조성 이중요금 계획</a><br>
      <a href="https://wdwnt.com/2026/06/studio-pass-pricing-updated-at-universal-studios-japan-making-early-purchases-more-affordable/" target="_blank" rel="noopener">USJ 스튜디오 패스 요금 안내</a>
    </div>`;
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
    if (!n) { ctx.fillStyle = '#566370'; ctx.font = '700 28px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('조건에 맞는 곳이 없어요', R, R); return; }
    const a = 2 * Math.PI / n;
    L.forEach((s, i) => {
      const a0 = rl.rot + i * a - Math.PI / 2, a1 = a0 + a;
      ctx.beginPath(); ctx.moveTo(R, R); ctx.arc(R, R, R - 4, a0, a1); ctx.closePath();
      ctx.fillStyle = THEMES[s.theme].color; ctx.globalAlpha = i % 2 ? .82 : 1; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
      if (n <= 40) {
        ctx.save(); ctx.translate(R, R); ctx.rotate(a0 + a / 2); ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
        ctx.font = `700 ${n > 24 ? 17 : n > 12 ? 21 : 26}px Pretendard Variable, sans-serif`;
        const t = s.name.length > 11 ? s.name.slice(0, 10) + '…' : s.name;
        ctx.fillText(t, R - 24, 8); ctx.restore();
      }
    });
  }
  function rlRefresh() {
    $$('#rlTheme .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.v === rl.theme));
    $$('#rlCity .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.v === rl.city));
    rl.list = rlPool();
    $('#rlCount').textContent = `후보 ${rl.list.length}곳${rl.excluded.size ? ` (제외 ${rl.excluded.size}곳 · 조건을 바꾸면 초기화)` : ''}`;
    $('#rlSpin').disabled = rl.list.length < 2;
    rlDraw();
  }
  function rlInit() {
    $('#rlTheme').innerHTML = '<button class="tab" data-v="all" style="--c:#101820"><span class="dot"></span>전체</button>' +
      Object.keys(THEMES).map(k => `<button class="tab" data-v="${k}" style="--c:${THEMES[k].color}"><span class="dot"></span>${THEMES[k].name}</button>`).join('');
    $('#rlCity').innerHTML = [['all','오사카·교토'],['osaka','오사카'],['kyoto','교토']].map(([v, n]) => `<button class="tab" data-v="${v}">${n}</button>`).join('');
    const reset = () => { rl.excluded.clear(); $('#rlResult').innerHTML = '<p class="note">아직 돌리지 않았습니다.</p>'; rlRefresh(); };
    $('#rlTheme').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b && !rl.spinning) { rl.theme = b.dataset.v; reset(); } });
    $('#rlCity').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b && !rl.spinning) { rl.city = b.dataset.v; reset(); } });
    $('#rlFree').addEventListener('change', e => { if (!rl.spinning) { rl.free = e.target.checked; reset(); } else e.target.checked = rl.free; });
    $('#rlSpin').addEventListener('click', rlSpin);
    $('#rlResult').addEventListener('click', e => {
      const g = e.target.closest('[data-rgo]'), x = e.target.closest('[data-rex]');
      if (g) { $('#dest').value = g.dataset.rgo; goRoute(true); $('#route').scrollIntoView({ behavior: 'smooth' }); }
      if (x) { rl.excluded.add(x.dataset.rex); rlRefresh(); rlSpin(); }
    });
    rlRefresh();
  }
  let actx = null;
  function rlTick(ptr, f) {
    ptr.classList.remove('tick'); void ptr.offsetWidth; ptr.classList.add('tick');
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'square'; o.frequency.value = 520 + 300 * f; g.gain.value = .04;
      g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + .06);
      o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + .07);
    } catch (e) {}
  }
  function rlSpin() {
    if (rl.spinning || rl.list.length < 2) return;
    rl.spinning = true; $('#rlSpin').disabled = true;
    const n = rl.list.length, a = 2 * Math.PI / n, pick = Math.floor(Math.random() * n);
    // 포인터(맨 위)가 선택 칸의 중앙을 가리키도록: rot + (pick+.5)*a ≡ 0
    const jitter = (Math.random() - .5) * a * .7;
    const base = -((pick + .5) * a) + jitter, start = rl.rot, turns = 9 + Math.floor(Math.random() * 5);
    let target = base; while (target < start + turns * 2 * Math.PI) target += 2 * Math.PI;
    const dur = reduce ? 1 : 6000 + Math.random() * 3500, t0 = performance.now(); // 6~9.5초
    const ptr = $('.rl-pointer'); let lastIdx = -1;
    const ease = f => 1 - Math.pow(1 - f, 5); // 처음엔 아주 빠르고 끝으로 갈수록 느려짐
    const step = now => {
      const f = Math.min(1, (now - t0) / dur), e = ease(f);
      rl.rot = start + (target - start) * e; rlDraw();
      // 화살표가 칸 경계를 지날 때마다 딸깍 (소리+흔들림). 느려질수록 간격이 벌어져 긴장감이 커짐
      const idx = Math.floor((((-rl.rot) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / a);
      if (idx !== lastIdx) { if (lastIdx !== -1 && !reduce) rlTick(ptr, f); lastIdx = idx; }
      if (f < 1) requestAnimationFrame(step); else { rl.rot = target % (2 * Math.PI); rlDone(rl.list[pick]); }
    };
    requestAnimationFrame(step);
  }
  function rlDone(s) {
    rl.spinning = false; $('#rlSpin').disabled = rl.list.length < 2;
    const T = THEMES[s.theme], p = nambaPlan[s.id];
    $('#rlResult').style.borderLeftColor = T.color;
    $('#rlResult').innerHTML = `<p class="note">${T.icon} ${T.name} · ${s.city === 'kyoto' ? '교토' : '오사카'} · ${esc(s.area)}</p><h3>${esc(s.name)}</h3>
      <div class="spot-fee">${feeHtml(s)}</div><div class="chips">${chipsHtml(p)}</div><p><b>난바에서 약 ${p.minutes}분${p.fare ? ' · ' + num(p.fare) + '엔' : ''}</b></p><p class="note">${esc(s.desc)}</p>
      <div class="rl-act"><button class="btn btn-primary" data-rgo="${s.id}" type="button">길찾기 ▶</button><button class="btn" data-rex="${s.id}" type="button">이곳 빼고 다시 돌리기</button></div>`;
  }

  /* ---------- 시작 ---------- */
  bindFamily(); renderTabs(); renderSpots();
  fillSelects(); initMap(); bindPlayer();
  renderDayTabs(); renderDay(); renderTours(); renderInfo(); rlInit();
  goRoute(false); // 첫 화면: 난바 → 오사카성 (자동재생 없음)
  anim.t = 0; anim.render(); anim.ui();
  // 지도 섹션이 화면에 들어오면 한 번만 재생
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); if (!reduce) { anim.t = 0; anim.play(); } } }, { threshold: .45 });
    io.observe($('#map'));
  }
  window.__app = { state, anim, goRoute, playDay };
})();
