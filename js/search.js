// search.php の場所（search.html からの相対パス）。置き場所に合わせてここだけ変更する
const SEARCH_API = '../php/search.php';

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  // 旧リンク(category=paper)も紙タバコ(cigarette)として扱う
  const rawCategory = params.get('category') || 'whisky';
  const category = (rawCategory === 'paper') ? 'cigarette' : rawCategory;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const categoryNames = {
    whisky: 'ウイスキー',
    cocktail: 'カクテル',
    sake: '日本酒',
    wine: 'ワイン',
    cigarette: '紙タバコ',
    vape: '電子タバコ'
  };

  // 1. カテゴリ表示更新
  const catBadge = document.getElementById('selectedCategoryBadge');
  if (catBadge) {
    catBadge.textContent = '◆ ' + (categoryNames[category] || 'お酒');
  }

  // 2. 製造国 vs 製造都道府県 の切り替え（ラベルのみ。候補はDBから取得）
  const countryLabel = document.getElementById('countryLabel');
  const countryInput = document.getElementById('countryInput');
  const countryList = document.getElementById('countryDatalist');
  const makerList = document.getElementById('makerDatalist');
  const brandList = document.getElementById('brandDatalist');

  if (category === 'sake') {
    if (countryLabel) countryLabel.textContent = '製造都道府県';
    if (countryInput) countryInput.placeholder = '例: 新潟県, 京都府...';
  } else if (category !== 'cocktail') {
    if (countryLabel) countryLabel.textContent = '製造国';
    if (countryInput) countryInput.placeholder = '例: スコットランド, 日本...';
  }

  // DBから候補を取得して datalist に反映
  async function loadOptions() {
    try {
      const res = await fetch(SEARCH_API + '?mode=options&category=' + encodeURIComponent(category));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'error');
      const toOptions = arr => arr.map(v => `<option value="${esc(v)}">`).join('');
      if (countryList) countryList.innerHTML = toOptions(data.countries || []);
      if (makerList) makerList.innerHTML = toOptions(data.makers || []);
      if (brandList) brandList.innerHTML = toOptions(data.brands || []);
      // シリーズ・種類はDBの登録値を選択肢にする（未登録の固定候補は出さない）
      if (category === 'vape') {
        const updateCheckboxes = (id, name, values) => {
          const box = document.getElementById(id);
          if (!box) return;
          box.replaceChildren();
          for (const value of values) {
            const label = document.createElement('label');
            label.className = 'checkbox-item';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = name + '[]';
            input.value = value;
            label.append(input, document.createTextNode(' ' + value));
            box.append(label);
          }
          if (!values.length) box.textContent = '登録データがありません';
        };
        updateCheckboxes('vapeLineOptions', 'vape_line', data.vape_lines || []);
        updateCheckboxes('vapeTypeOptions', 'vape_type', data.vape_types || []);
      }
    } catch (e) {
      console.error('候補の取得に失敗しました', e);
    }
  }

  // 3. カクテルのみ「基本情報」セクション全体を非表示にする
  const basicInfoSection = document.getElementById('basicInfoSection');
  if (basicInfoSection) {
    if (category === 'cocktail') {
      basicInfoSection.style.display = 'none';
    } else {
      basicInfoSection.style.display = 'block';
    }
  }

  // 4. 種別固有のチェックボックス切り替え
  const whiskyOpts = document.getElementById('whiskySpecific');
  const sakeOpts = document.getElementById('sakeSpecific');
  const wineOpts = document.getElementById('wineSpecific');
  const cocktailOpts = document.getElementById('cocktailSpecific');
  const paperOpts = document.getElementById('paperSpecific');

  if (whiskyOpts) whiskyOpts.style.display = (category === 'whisky') ? 'block' : 'none';
  if (sakeOpts) sakeOpts.style.display = (category === 'sake') ? 'block' : 'none';
  if (wineOpts) wineOpts.style.display = (category === 'wine') ? 'block' : 'none';
  if (cocktailOpts) cocktailOpts.style.display = (category === 'cocktail') ? 'block' : 'none';
  if (paperOpts) paperOpts.style.display = (category === 'cigarette') ? 'block' : 'none';

  // 電子タバコは専用パネルだけを表示。お酒用の度数・年代・国・味/酸味は排除する。
  const normalGrid = document.querySelector('#searchForm > .filter-grid');
  const vapeGrid = document.getElementById('vapeFilterGrid');
  if (category === 'vape') {
    if (normalGrid) normalGrid.hidden = true;
    if (normalGrid) normalGrid.style.display = 'none';
    if (vapeGrid) vapeGrid.hidden = false;
  }

  // 4-2. 紙たばこ: 不要な項目を隠し、値段の選択肢を紙たばこ向けに差し替える
  if (category === 'cigarette') {
    ['scoreSection', 'countryFilterGroup', 'ageFilterGroup', 'abvFilterGroup'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const yen = [300, 400, 450, 500, 550, 600];
    document.querySelectorAll('select[name="price_min"], select[name="price_max"]').forEach(sel => {
      const first = sel.options[0].outerHTML; // 「下限なし」「上限なし」
      sel.innerHTML = first + yen.map(v => `<option value="${v}">${v}円</option>`).join('');
    });
  }

  // 5. 5段階評価ボタンの2回目クリックで選択解除する処理（確実動作版）
  const ratingInputs = document.querySelectorAll('.rating-options input[type="radio"]');

  ratingInputs.forEach(radio => {
    // マウスが押された瞬間の状態を記録しておく
    radio.addEventListener('mousedown', function() {
      this.dataset.wasChecked = this.checked ? "true" : "false";
    });

    // クリックされたときの処理
    radio.addEventListener('click', function() {
      // 「もともと選択されていた状態」でクリックされた場合はチェックを外す
      if (this.dataset.wasChecked === "true") {
        this.checked = false;
        this.dataset.wasChecked = "false";
        this.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        this.dataset.wasChecked = "true";
        // 同じグループの他のボタンの状態をリセット
        document.querySelectorAll(`input[type="radio"][name="${this.name}"]`).forEach(other => {
          if (other !== this) other.dataset.wasChecked = "false";
        });
      }
    });
  });

  // 6. 検索実行と結果描画
  const form = document.getElementById('searchForm');
  const grid = document.getElementById('resultGrid');
  const countEl = document.getElementById('resultCount');
  const pagerEl = document.getElementById('pager');

  // カテゴリーごとに検索状態を sessionStorage に保存するキー
  const STATE_STORAGE_KEY = `shikonoryoiki_search_state_${category}`;

  function saveSearchState(page) {
    if (!form) return;
    const fields = [];
    const elements = Array.from(form.elements);

    for (const el of elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked) {
          fields.push({ name: el.name, type: el.type, value: el.value });
        }
      } else {
        fields.push({ name: el.name, type: el.type, value: el.value });
      }
    }

    try {
      sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify({
        category,
        page: Number(page) || 1,
        fields
      }));
    } catch (e) {
      console.warn('検索状態の保存に失敗しました', e);
    }
  }

  function restoreSearchState() {
    let raw = null;
    try {
      raw = sessionStorage.getItem(STATE_STORAGE_KEY);
    } catch (e) {
      return 1;
    }
    if (!raw || !form) return 1;

    try {
      const saved = JSON.parse(raw);
      if (!saved || saved.category !== category || !Array.isArray(saved.fields)) {
        return 1;
      }

      // 一旦チェック系をリセットしてから復元
      form.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(el => {
        el.checked = false;
        el.dataset.wasChecked = 'false';
      });

      for (const item of saved.fields) {
        if (item.type === 'checkbox') {
          const cb = Array.from(form.querySelectorAll(`input[type="checkbox"][name="${CSS.escape(item.name)}"]`))
            .find(el => el.value === item.value);
          if (cb) cb.checked = true;
        } else if (item.type === 'radio') {
          const rb = Array.from(form.querySelectorAll(`input[type="radio"][name="${CSS.escape(item.name)}"]`))
            .find(el => el.value === item.value);
          if (rb) {
            rb.checked = true;
            rb.dataset.wasChecked = 'true';
          }
        } else {
          const el = form.elements.namedItem(item.name);
          if (el && 'value' in el) {
            el.value = item.value;
          }
        }
      }

      return Number(saved.page) > 0 ? Number(saved.page) : 1;
    } catch (e) {
      console.warn('検索状態の復元に失敗しました', e);
      return 1;
    }
  }

  function renderPager(current, total) {
    pagerEl.innerHTML = '';
    if (total <= 1) return;
    const add = (label, page, disabled = false, active = false) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'clear-btn';
      b.textContent = label;
      b.disabled = disabled;
      if (active) { b.style.borderColor = 'var(--gold)'; b.style.color = 'var(--gold)'; }
      if (disabled) b.style.opacity = '0.4';
      if (!disabled && !active) b.addEventListener('click', () => {
        runSearch(page);
        window.scrollTo({ top: grid.offsetTop - 200, behavior: 'smooth' });
      });
      pagerEl.appendChild(b);
    };
    add('← 前へ', current - 1, current === 1);
    // 現在ページの前後2ページ + 先頭・末尾を表示
    let last = 0;
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - current) <= 2) {
        if (last && i - last > 1) {
          const dots = document.createElement('span');
          dots.textContent = '…';
          dots.style.color = 'var(--muted)';
          pagerEl.appendChild(dots);
        }
        add(String(i), i, false, i === current);
        last = i;
      }
    }
    add('次へ →', current + 1, current === total);
  }

  async function runSearch(page = 1) {
    saveSearchState(page);
    const q = new URLSearchParams(new FormData(form));
    // 電子タバコ検索では、非表示にしたお酒用入力欄をリクエストに送らない。
    if (category === 'vape') {
      for (const key of [...q.keys()]) {
        if (key !== 'keyword' && !key.startsWith('vape_')) q.delete(key);
      }
    }
    q.set('category', category);
    q.set('page', page);
    try {
      const res = await fetch(SEARCH_API + '?' + q.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'error');

      const totalPages = Math.max(1, Math.ceil(data.total / data.per_page));
      const from = data.total ? (data.page - 1) * data.per_page + 1 : 0;
      const to = Math.min(data.page * data.per_page, data.total);
      countEl.textContent = `${data.total} 件見つかりました（${from}〜${to} 件を表示）`;
      renderPager(data.page, totalPages);
      grid.innerHTML = data.items.map(p => {
        const sub = (category === 'cigarette')
          ? [
              p.brand,
              p.tar_mg != null ? `タール ${Number(p.tar_mg)}mg` : null,
              p.nicotine_mg != null ? `ニコチン ${Number(p.nicotine_mg)}mg` : null,
              p.price != null ? Number(p.price).toLocaleString() + '円' : null
            ].filter(Boolean).join(' / ')
          : (category === 'vape')
            ? [
                p.product_line, p.type_label,
                p.strength_score != null ? `吸いごたえ ${Number(p.strength_score)}/5` : '吸いごたえ 未評価',
                p.aroma_score != null ? `香り ${Number(p.aroma_score)}/5` : null,
                p.richness_score != null ? `コク ${Number(p.richness_score)}/5` : null
              ].filter(Boolean).join(' / ')
            : [
                p.prefecture || p.country_name || p.base_liquor_name,
                p.abv ? p.abv + '%' : null
              ].filter(Boolean).join(' / ');
        return `
          <a href="detail.html?id=${encodeURIComponent(p.product_id)}&amp;from=search&amp;category=${encodeURIComponent(category)}" class="answer-card">
            <span style="font-size:11px;color:var(--gold);">${esc(category.toUpperCase())}</span>
            <strong style="font-size:16px;color:var(--cream);">${esc(p.product_name)}</strong>
            <span style="font-size:12px;color:#aaa;">${esc(sub)}</span>
            <small style="color:var(--muted);">詳細を見る →</small>
          </a>`;
      }).join('') || '<p style="color:var(--muted)">該当する商品がありません。</p>';
    } catch (e) {
      console.error(e);
      countEl.textContent = '検索に失敗しました。';
      grid.innerHTML = '';
      pagerEl.innerHTML = '';
    }
  }

  window.runSearch = runSearch;
  form.addEventListener('submit', e => { e.preventDefault(); runSearch(1); });
  loadOptions().then(() => {
    const restoredPage = restoreSearchState();
    runSearch(restoredPage);
  });
});

function resetFilters() {
  const form = document.getElementById('searchForm');
  if (form) {
    form.reset();
    document.querySelectorAll('.rating-options input[type="radio"]').forEach(radio => {
      radio.dataset.wasChecked = "false";
    });
    const params = new URLSearchParams(window.location.search);
    const rawCategory = params.get('category') || 'whisky';
    const category = (rawCategory === 'paper') ? 'cigarette' : rawCategory;
    try {
      sessionStorage.removeItem(`shikonoryoiki_search_state_${category}`);
    } catch (e) {}
    if (window.runSearch) window.runSearch(1);
  }
}

//上に戻るボタン
document.addEventListener('DOMContentLoaded', () => {
    const scrollTopBtn = document.getElementById('scrollTopBtn');
    if (!scrollTopBtn) return;

    // スクロール量に応じて表示・非表示を切り替え
    window.addEventListener('scroll', () => {
        if (window.scrollY > 250) {
            scrollTopBtn.classList.add('is-visible');
        } else {
            scrollTopBtn.classList.remove('is-visible');
        }
    }, { passive: true });

    // クリックでスムーズに一番上へ移動
    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
});