/* 간이 대중교통 경로 탐색 (데이터는 data.js의 역·노선 그래프)
 * - 소요시간·요금은 "대략치"입니다. 정확한 값은 Google 지도/Navitime 등으로 확인하세요.
 */
window.Router = (function () {
  const ST = DATA.stations, LINES = DATA.lines;
  const adj = {}; // node -> [{to, line, min}]
  function addEdge(a, b, line, min) {
    (adj[a] = adj[a] || []).push({ to: b, line, min });
    (adj[b] = adj[b] || []).push({ to: a, line, min });
  }
  Object.keys(LINES).forEach(id => {
    const L = LINES[id];
    for (let i = 0; i < L.stops.length - 1; i++) addEdge(L.stops[i], L.stops[i + 1], id, L.hops[i]);
  });
  DATA.walks.forEach(w => addEdge(w[0], w[1], 'W', w[2]));

  const TRANSFER = 4, WAIT = 3;

  function hav(a, b, c, d) { // km
    const R = 6371, rad = Math.PI / 180;
    const dLat = (c - a) * rad, dLng = (d - b) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const walkMin = km => Math.max(1, Math.round(km * 1.3 / 0.075)); // 75m/분, 굴곡 1.3배

  /* 다익스트라 (상태: 역|직전노선) */
  function shortest(src, dst) {
    const key = (n, l) => n + '|' + l;
    const dist = { [key(src, '-')]: 0 }, prev = {}, done = {};
    const open = [[0, src, '-']];
    let best = null;
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [d, n, l] = open.shift();
      const k = key(n, l);
      if (done[k]) continue; done[k] = true;
      if (n === dst) { best = k; break; }
      (adj[n] || []).forEach(e => {
        let cost = e.min;
        if (e.line !== 'W') {
          if (l === '-' || l === 'W') cost += WAIT;
          else if (l !== e.line) cost += TRANSFER;
        }
        const nk = key(e.to, e.line), nd = d + cost;
        if (dist[nk] === undefined || nd < dist[nk]) { dist[nk] = nd; prev[nk] = { k, edge: e, from: n }; open.push([nd, e.to, e.line]); }
      });
    }
    if (!best) return null;
    const edges = []; let k = best;
    while (prev[k]) { edges.unshift(prev[k]); k = prev[k].k; }
    // 같은 노선 연속 구간 묶기
    const legs = [];
    edges.forEach(p => {
      const last = legs[legs.length - 1];
      if (last && last.line === p.edge.line) { last.stops.push(p.edge.to); last.min += p.edge.min; }
      else legs.push({ line: p.edge.line, stops: [p.from, p.edge.to], min: p.edge.min });
    });
    return { legs, cost: dist[best] };
  }

  /* 요금 추정 (성인, 엔) — 대략치 */
  const metroTier = km => km <= 3 ? 190 : km <= 7 ? 240 : km <= 13 ? 290 : km <= 19 ? 330 : 380;
  const jrTier = km => km <= 3 ? 150 : km <= 6 ? 170 : km <= 10 ? 190 : km <= 15 ? 240 : km <= 20 ? 330 : km <= 25 ? 420 : 510;
  function legKm(l) {
    let s = 0;
    for (let i = 0; i < l.stops.length - 1; i++) {
      const a = ST[l.stops[i]], b = ST[l.stops[i + 1]];
      s += hav(a[1], a[2], b[1], b[2]) * 1.2;
    }
    return s;
  }
  function estimateFare(legs) {
    let fare = 0, mKm = 0, jKm = 0, jEnds = [];
    legs.forEach(l => {
      if (l.line === 'W') return;
      const L = LINES[l.line];
      if (L.op === 'metro') mKm += legKm(l);
      else if (L.op === 'jr') { jKm += legKm(l); jEnds.push(l); }
      else fare += L.fare || 0;
    });
    if (mKm > 0) fare += metroTier(mKm);
    if (jKm > 0) {
      const hasJK = legs.some(l => l.line === 'JK');
      if (hasJK) {
        fare += 580;
        legs.forEach(l => { if (l.line !== 'JK' && LINES[l.line] && LINES[l.line].op === 'jr') fare += (LINES[l.line].extra || 150); });
      } else fare += jrTier(jKm);
    }
    return Math.round(fare / 10) * 10;
  }

  /* 후보 역: 좌표 기준 가까운 순 */
  function nearestStations(lat, lng, n) {
    return Object.keys(ST).map(id => ({ id, km: hav(lat, lng, ST[id][1], ST[id][2]) }))
      .sort((a, b) => a.km - b.km).slice(0, n || 3);
  }

  /* 출발 좌표(lat,lng) → 도착 장소(spot) 전체 계획 */
  function plan(origin, spot) {
    const oc = nearestStations(origin.lat, origin.lng, 3);
    const nearest = oc[0].km;
    // 출발점이 목적지와 가까우면 도보
    const direct = hav(origin.lat, origin.lng, spot.lat, spot.lng);
    let best = null;
    const dcs = spot.st && spot.st.length ? spot.st : nearestStations(spot.lat, spot.lng, 2).map(o => [o.id, walkMin(o.km)]);
    oc.forEach(o => {
      if (o.km > 6) return;
      const ow = walkMin(o.km);
      dcs.forEach(([did, dw]) => {
        const r = o.id === did ? { legs: [], cost: 0 } : shortest(o.id, did);
        if (!r) return;
        const total = ow + r.cost + dw;
        if (!best || total < best.total) best = { total, o, ow, did, dw, r };
      });
    });
    const out = { outOfArea: false, steps: [], minutes: 0, fare: 0, nearestKm: nearest };
    if (direct < 1.1 || !best) {
      if (direct >= 1.1 && !best) { out.outOfArea = true; }
      const m = walkMin(direct);
      out.steps = [{ type: 'walk', label: '도보', min: m, pts: [[origin.lat, origin.lng], [spot.lat, spot.lng]], from: '출발지', to: spot.name }];
      out.minutes = m; out.walkOnly = true;
      return out;
    }
    const steps = [];
    const os = ST[best.o.id];
    if (best.ow >= 1) steps.push({ type: 'walk', label: '도보', min: best.ow, from: '출발지', to: os[0], pts: [[origin.lat, origin.lng], [os[1], os[2]]] });
    best.r.legs.forEach(l => {
      const L = l.line === 'W' ? null : LINES[l.line];
      const pts = l.stops.map(s => [ST[s][1], ST[s][2]]);
      if (!L) steps.push({ type: 'walk', label: '환승 도보', min: l.min, from: ST[l.stops[0]][0], to: ST[l.stops[l.stops.length - 1]][0], pts });
      else steps.push({ type: L.op === 'bus' ? 'bus' : 'ride', line: l.line, label: L.name, color: L.color, min: l.min,
        from: ST[l.stops[0]][0], to: ST[l.stops[l.stops.length - 1]][0], n: l.stops.length - 1, pts });
    });
    const ds = ST[best.did];
    steps.push({ type: 'walk', label: '도보', min: best.dw, from: ds[0], to: spot.name, pts: [[ds[1], ds[2]], [spot.lat, spot.lng]] });
    out.steps = steps;
    out.minutes = best.total;
    out.fare = estimateFare(best.r.legs);
    return out;
  }

  function planBetweenSpots(a, b) { return plan({ lat: a.lat, lng: a.lng }, b); }

  /* 가족 요금: 어린이는 성인의 절반(10엔 올림) */
  function familyFare(fare, adults, kids) {
    return fare * adults + Math.ceil(fare / 2 / 10) * 10 * kids;
  }

  return { plan, planBetweenSpots, familyFare, hav, walkMin, nearestStations };
})();
