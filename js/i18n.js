/* 다국어 엔진: t(key, vars) = 화면 문구, L10N.* = 장소·역·일정 같은 데이터 번역
 * 번역 파일(js/lang/*.js)이 없는 항목은 한국어 원문으로 대체됩니다. */
(function () {
  const LANGS = [
    { code: 'ko', label: '한국어', locale: 'ko-KR' },
    { code: 'en', label: 'English', locale: 'en-US' },
    { code: 'ja', label: '日本語', locale: 'ja-JP' },
    { code: 'zh', label: '简体中文', locale: 'zh-CN', html: 'zh-CN' },
    { code: 'es', label: 'Español', locale: 'es-ES' }
  ];
  const dict = {};
  let cur = 'ko';

  function add(code, obj) { dict[code] = obj; }
  function t(key, vars) {
    let s = dict[cur] && dict[cur].ui && dict[cur].ui[key];
    if (s == null) s = dict.ko && dict.ko.ui[key];
    if (s == null) return key;
    return s.replace(/\{(\w+)\}/g, (m, k) => vars && vars[k] != null ? vars[k] : m);
  }
  function pick(group, id, fallback) {
    const d = dict[cur]; const v = d && d[group] && d[group][id];
    return v != null ? v : fallback;
  }
  const L10N = {
    langs: LANGS,
    get cur() { return cur; },
    locale() { return (LANGS.find(l => l.code === cur) || LANGS[0]).locale; },
    st: id => pick('st', id, DATA.stations[id] && DATA.stations[id][0]),
    ln: id => pick('ln', id, DATA.lines[id] && DATA.lines[id].name),
    org: id => pick('org', id, DATA.origins[id] && DATA.origins[id].name),
    th: id => pick('th', id, DATA.THEMES[id].name),
    // 장소: name/area/desc/tip/hours/closed, 요금 메모 fnote, 요금 라벨 flabel
    sp(s, f) {
      const d = dict[cur], o = d && d.sp && d.sp[s.id];
      if (o && o[f] != null) return o[f];
      if (f === 'name' && cur === 'ja' && s.ja) return s.ja;
      if (f === 'fnote') return s.fee && s.fee.note;
      if (f === 'flabel') return s.fee && s.fee.label;
      return s[f];
    },
    day(day, f) { const o = pick('day', day.id, null); return o && o[f] != null ? o[f] : day[f]; },
    dayItem(day, id, fallback) { const o = pick('day', day.id, null); return o && o.items && o.items[id] != null ? o.items[id] : fallback; },
    tour(tr, f) { const o = pick('tour', tr.id, null); return o && o[f] != null ? o[f] : tr[f]; },
    diy(f) { const o = pick('diy', f, null); return o != null ? o : DATA.kyotoDIY[f]; },
    // 검색용: 모든 언어의 이름·지역·설명을 한 문자열로
    haystack(s) {
      let h = [s.name, s.ja, s.area, s.desc].join(' ');
      Object.keys(dict).forEach(c => { const o = dict[c].sp && dict[c].sp[s.id]; if (o) h += ' ' + [o.name, o.area, o.desc].join(' '); });
      return h.toLowerCase();
    },
    num(n) { return Number(n).toLocaleString(this.locale(), { useGrouping: 'always' }); },
    set(code) {
      if (!dict[code]) code = 'en';
      cur = code;
      try { localStorage.setItem('osaka-lang', code); } catch (e) {}
      document.documentElement.lang = (LANGS.find(l => l.code === code) || {}).html || code;
      applyStatic();
      window.dispatchEvent(new Event('langchange'));
    },
    detect() {
      let c = null;
      try { c = new URLSearchParams(location.search).get('lang') || localStorage.getItem('osaka-lang'); } catch (e) {}
      if (!c) {
        const nav = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'ko']).map(x => String(x).toLowerCase());
        for (const n of nav) {
          if (n.startsWith('ko')) { c = 'ko'; break; } if (n.startsWith('ja')) { c = 'ja'; break; }
          if (n.startsWith('zh')) { c = 'zh'; break; } if (n.startsWith('es')) { c = 'es'; break; }
          if (n.startsWith('en')) { c = 'en'; break; }
        }
      }
      return dict[c] ? c : (c ? 'en' : 'ko');
    }
  };

  function applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.title = t('meta_title');
    const md = document.querySelector('meta[name=description]'); if (md) md.content = t('meta_desc');
    const sel = document.getElementById('lang'); if (sel) sel.value = cur;
  }

  window.I18N = { add };
  window.L10N = L10N;
  window.t = t;
  window.i18nApplyStatic = applyStatic;
  window.i18nInit = function () {
    const sel = document.getElementById('lang');
    if (sel) {
      sel.innerHTML = LANGS.map(l => `<option value="${l.code}">${l.label}</option>`).join('');
      sel.addEventListener('change', () => L10N.set(sel.value));
    }
    cur = L10N.detect();
    document.documentElement.lang = (LANGS.find(l => l.code === cur) || {}).html || cur;
    applyStatic();
  };
})();
