const MAX_SELECTED = 4;

const state = {
  selected: [],
  activeIdx: -1,
  grouping: 'flat', // 'flat' | 'theme'
};

const els = {
  search: document.getElementById('search'),
  suggestions: document.getElementById('suggestions'),
  selected: document.getElementById('selected'),
  results: document.getElementById('results'),
  emptyState: document.getElementById('empty-state'),
  counter: document.getElementById('counter'),
  toolbar: document.getElementById('results-toolbar'),
  toggles: document.querySelectorAll('.toggle-group .toggle'),
};

els.toggles.forEach(btn => {
  btn.addEventListener('click', () => {
    state.grouping = btn.dataset.group;
    els.toggles.forEach(b => {
      const on = b.dataset.group === state.grouping;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    renderResults();
  });
});

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function renderChips() {
  els.selected.innerHTML = '';
  for (const name of state.selected) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = name;
    const x = document.createElement('button');
    x.type = 'button';
    x.setAttribute('aria-label', `Remove ${name}`);
    x.textContent = '×';
    x.addEventListener('click', () => {
      state.selected = state.selected.filter(n => n !== name);
      renderChips();
      renderResults();
      updateCounter();
      updateSearchEnabled();
    });
    chip.appendChild(x);
    els.selected.appendChild(chip);
  }
}

function updateCounter() {
  els.counter.textContent = `${state.selected.length} / ${MAX_SELECTED} selected`;
}

function updateSearchEnabled() {
  if (state.selected.length >= MAX_SELECTED) {
    els.search.disabled = true;
    els.search.placeholder = 'Maximum of 4 Pokémon reached — remove one to swap';
    closeSuggestions();
  } else {
    els.search.disabled = false;
    els.search.placeholder = 'Start typing… (e.g. Pikachu, Eevee)';
  }
}

function addPokemon(name) {
  if (state.selected.includes(name)) return;
  if (state.selected.length >= MAX_SELECTED) return;
  state.selected.push(name);
  els.search.value = '';
  closeSuggestions();
  renderChips();
  renderResults();
  updateCounter();
  updateSearchEnabled();
}

function showSuggestions(query) {
  const q = normalize(query.trim());
  if (!q) {
    closeSuggestions();
    return;
  }
  const matches = POKEMON_LIST
    .filter(name => normalize(name).includes(q))
    .slice(0, 12);

  if (matches.length === 0) {
    els.suggestions.innerHTML = '<li class="disabled">No matches</li>';
    els.suggestions.classList.add('open');
    state.activeIdx = -1;
    return;
  }

  els.suggestions.innerHTML = '';
  matches.forEach((name, i) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.dataset.name = name;
    const already = state.selected.includes(name);
    if (already) li.classList.add('disabled');
    const favCount = POKEMON[name].length;
    li.innerHTML = `<span>${name}${already ? ' (added)' : ''}</span><span class="meta">${favCount} favorite${favCount === 1 ? '' : 's'}</span>`;
    if (!already) {
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        addPokemon(name);
      });
    }
    els.suggestions.appendChild(li);
  });
  els.suggestions.classList.add('open');
  state.activeIdx = -1;
}

function closeSuggestions() {
  els.suggestions.classList.remove('open');
  els.suggestions.innerHTML = '';
  state.activeIdx = -1;
}

function setActive(idx) {
  const items = els.suggestions.querySelectorAll('li:not(.disabled)');
  if (items.length === 0) return;
  items.forEach(li => li.classList.remove('active'));
  state.activeIdx = (idx + items.length) % items.length;
  items[state.activeIdx].classList.add('active');
  items[state.activeIdx].scrollIntoView({ block: 'nearest' });
}

els.search.addEventListener('input', () => showSuggestions(els.search.value));
els.search.addEventListener('focus', () => {
  if (els.search.value) showSuggestions(els.search.value);
});
els.search.addEventListener('blur', () => setTimeout(closeSuggestions, 150));
els.search.addEventListener('keydown', (e) => {
  const items = els.suggestions.querySelectorAll('li:not(.disabled)');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (items.length) setActive(state.activeIdx + 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (items.length) setActive(state.activeIdx - 1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (state.activeIdx >= 0 && items[state.activeIdx]) {
      addPokemon(items[state.activeIdx].dataset.name);
    } else if (items.length === 1) {
      addPokemon(items[0].dataset.name);
    }
  } else if (e.key === 'Escape') {
    closeSuggestions();
  }
});

function buildItemMaps() {
  // item -> Set of selected pokemon who enjoy it
  // item -> Set of categories it belongs to
  // pokemon -> Set of items they enjoy
  const itemToPokemon = new Map();
  const itemToCategories = new Map();
  const pokemonItems = {};

  for (const name of state.selected) {
    const items = new Set();
    for (const cat of POKEMON[name]) {
      for (const item of CATEGORIES[cat].items) {
        items.add(item);
        if (!itemToCategories.has(item)) itemToCategories.set(item, new Set());
        itemToCategories.get(item).add(cat);
      }
    }
    pokemonItems[name] = items;
    for (const item of items) {
      if (!itemToPokemon.has(item)) itemToPokemon.set(item, new Set());
      itemToPokemon.get(item).add(name);
    }
  }
  return { itemToPokemon, itemToCategories, pokemonItems };
}

function renderResults() {
  if (state.selected.length === 0) {
    els.toolbar.hidden = true;
    els.results.innerHTML = '<div class="empty-state">Select at least 2 Pokémon to see what they have in common.</div>';
    return;
  }
  els.toolbar.hidden = false;

  const { itemToPokemon, itemToCategories, pokemonItems } = buildItemMaps();

  if (state.selected.length === 1) {
    const name = state.selected[0];
    const items = [...pokemonItems[name]].sort();
    const cats = POKEMON[name];
    let html = `<div class="summary">${escapeHtml(name)} enjoys <strong>${items.length}</strong> item${items.length === 1 ? '' : 's'} across <strong>${cats.length}</strong> favorite categor${cats.length === 1 ? 'y' : 'ies'}: <em>${cats.map(escapeHtml).join(', ')}</em>. Add another Pokémon to find shared favorites.</div>`;
    html += renderItemSection({
      title: `Items ${name} enjoys`,
      items,
      itemToPokemon,
      itemToCategories,
      excludeFromBadge: name,
      variant: 'solo',
    });
    els.results.innerHTML = html;
    return;
  }

  const setsList = state.selected.map(n => new Set(POKEMON[n]));
  const sharedCategories = [...setsList[0]].filter(c => setsList.every(s => s.has(c)));

  const sharedItems = [...itemToPokemon.entries()]
    .filter(([, pokes]) => pokes.size === state.selected.length)
    .map(([item]) => item)
    .sort();

  // Split shared items: those reachable via a shared category vs those that
  // come from category overlap (different categories that contain the same item).
  const sharedCatItemSet = new Set();
  for (const c of sharedCategories) {
    for (const it of CATEGORIES[c].items) sharedCatItemSet.add(it);
  }
  const viaSharedCats = sharedItems.filter(it => sharedCatItemSet.has(it));
  const viaOtherOverlap = sharedItems.filter(it => !sharedCatItemSet.has(it));

  let html = `<div class="summary">
      <div><strong>Roommates:</strong> ${state.selected.map(escapeHtml).join(', ')}</div>
      <div><strong>Shared categories (${sharedCategories.length}):</strong> ${sharedCategories.length ? sharedCategories.map(escapeHtml).join(', ') : '<em>none</em>'}</div>
      <div><strong>Items everyone enjoys:</strong> ${sharedItems.length} <span class="muted">(${viaSharedCats.length} via shared categories &middot; ${viaOtherOverlap.length} via other overlap)</span></div>
    </div>`;

  if (sharedItems.length === 0) {
    html += `<div class="no-overlap">😔 No items overlap across all selected Pokémon — but each one still has favorites below.</div>`;
  } else {
    html += renderItemSection({
      title: '✨ Shared via shared favorite categories',
      items: viaSharedCats,
      itemToPokemon,
      itemToCategories,
      variant: 'shared',
      emptyMessage: 'No items in this section — these roommates have no fully-shared favorite categories.',
    });
    html += renderItemSection({
      title: '🎯 Shared via other category overlap',
      items: viaOtherOverlap,
      itemToPokemon,
      itemToCategories,
      variant: 'shared-alt',
      emptyMessage: 'No extras — every shared item is already covered by a shared category.',
    });
  }

  if (sharedCategories.length > 0) {
    html += `<h3 class="section-heading">Shared favorite categories (full lists)</h3>`;
    const sortedCats = sharedCategories.slice().sort((a, b) => CATEGORIES[b].items.length - CATEGORIES[a].items.length);
    for (const cat of sortedCats) {
      html += renderItemSection({
        title: cat,
        items: CATEGORIES[cat].items,
        itemToPokemon,
        itemToCategories,
        variant: 'sharedcat',
      });
    }
  }

  html += `<h3 class="section-heading">Individual favorites</h3>`;

  const sharedSet = new Set(sharedItems);
  for (const name of state.selected) {
    const exclusive = [...pokemonItems[name]].filter(it => !sharedSet.has(it)).sort();
    html += renderItemSection({
      title: name,
      items: exclusive,
      itemToPokemon,
      itemToCategories,
      excludeFromBadge: name,
      variant: 'pokemon',
      emptyMessage: `All of ${escapeHtml(name)}'s favorites are already in the shared list above!`,
    });
  }

  els.results.innerHTML = html;
}

function groupItemsByCategory(items) {
  const groups = {};
  for (const it of items) {
    const c = ITEM_PRIMARY_CATEGORY[it] || 'Uncategorized';
    if (!groups[c]) groups[c] = [];
    groups[c].push(it);
  }
  const ordered = [];
  for (const c of ITEM_CATEGORY_ORDER) {
    if (groups[c]) ordered.push([c, groups[c].sort()]);
  }
  if (groups['Uncategorized']) ordered.push(['Uncategorized', groups['Uncategorized'].sort()]);
  return ordered;
}

function renderItemSection({ title, items, itemToPokemon, itemToCategories, excludeFromBadge, variant, emptyMessage }) {
  const variantClass = variant ? ` ${variant}-card` : '';
  if (items.length === 0) {
    return `<div class="category-card${variantClass}">
      <div class="category-header">
        <span>${escapeHtml(title)}</span>
        <span class="item-count">0 items</span>
      </div>
      <div class="empty-section">${emptyMessage || 'No items in this section.'}</div>
    </div>`;
  }

  const renderItem = it => {
    const cats = itemToCategories ? itemToCategories.get(it) : null;
    const catsTitle = cats ? [...cats].sort().join(', ') : '';
    let badge = '';
    if (excludeFromBadge && itemToPokemon && itemToPokemon.has(it)) {
      const others = [...itemToPokemon.get(it)].filter(p => p !== excludeFromBadge);
      if (others.length > 0) {
        badge = `<span class="co-badge" title="Also enjoyed by: ${escapeHtml(others.join(', '))}">+${others.length}</span>`;
      }
    }
    return `<div class="item" title="Category: ${escapeHtml(catsTitle)}">${escapeHtml(it)}${badge}</div>`;
  };

  let body;
  if (state.grouping === 'category') {
    const groups = groupItemsByCategory(items);
    body = groups.map(([cat, catItems]) => `
      <div class="theme-group">
        <div class="theme-heading">
          <span>${escapeHtml(cat)}</span>
          <span class="theme-count">${catItems.length}</span>
        </div>
        <div class="item-grid">${catItems.map(renderItem).join('')}</div>
      </div>
    `).join('');
  } else {
    body = `<div class="item-grid">${items.map(renderItem).join('')}</div>`;
  }

  return `<div class="category-card${variantClass}">
    <div class="category-header">
      <span>${escapeHtml(title)}</span>
      <span class="item-count">${items.length} item${items.length === 1 ? '' : 's'}</span>
    </div>
    ${body}
  </div>`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrap')) closeSuggestions();
});

updateCounter();
renderChips();
renderResults();
