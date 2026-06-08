/* ================================================================
   PokéTopia — app.js
   ================================================================ */

const API = 'https://api.pokemontcg.io/v2';
const STORAGE_KEY = 'poketopia_v1';

/* Rarity sort order: higher = rarer (user-specified, with substitutions) */
const RARITY_RANK = {
  'Promo':                        130,
  'Hyper Rare':                   120,  // substituted from "Mega Hyper Rare"
  'Rare Secret':                  110,  // substituted from "Monochrome Rare"
  'Special Illustration Rare':    100,
  'ACE SPEC Rare':                 90,  // substituted from "Mega Attack Rare"
  'Illustration Rare':             80,
  'Shiny Ultra Rare':              75,
  'Ultra Rare':                    65,
  'Rare Ultra':                    65,
  'Rare Rainbow':                  65,
  'Rare Shiny GX':                 72,
  'Rare Shiny':                    70,
  'Shiny Rare':                    68,
  'Amazing Rare':                  63,
  'Rare Prism Star':               62,
  'Trainer Gallery Rare Holo':     61,
  'Rare VSTAR':                    59,
  'Rare Holo VMAX':                58,
  'Rare Holo V':                   57,
  'Rare Holo GX':                  57,
  'Rare Holo EX':                  56,
  'Rare Prime':                    55,
  'Double Rare':                   55,
  'Rare BREAK':                    53,
  'Rare Holo':                     52,
  'Rare':                          50,
  'Uncommon':                      40,
  'Common':                        30,
};

/* Maps card-type filter values → pokemontcg.io query fragments */
const TYPE_MAP = {
  pokemon:   'supertype:Pokémon',
  supporter: 'subtypes:Supporter',
  item:      'subtypes:Item',
  stadium:   'subtypes:Stadium',
  energy:    'supertype:Energy',
};

/* Maps era filter values → pokemontcg.io Lucene query fragments */
const ERA_MAP = {
  sv:   'set.series:"Scarlet & Violet"',
  swsh: 'set.series:"Sword & Shield"',
  sm:   'set.series:"Sun & Moon"',
  xy:   'set.series:XY',
  bw:   'set.series:"Black & White"',
  hgss: 'set.series:"HeartGold & SoulSilver"',
  dp:   '(set.series:"Diamond & Pearl" OR set.series:Platinum)',
  ex:   'set.series:EX',
  neo:  '(set.series:Neo OR set.series:Gym OR set.series:Base)',
};

/* Pool for random auto-populate when the search panel opens empty */
const POPULAR_POKEMON = [
  'Charizard','Pikachu','Mewtwo','Blastoise','Venusaur','Gengar',
  'Umbreon','Espeon','Sylveon','Eevee','Jolteon','Vaporeon','Flareon',
  'Leafeon','Glaceon','Rayquaza','Lugia','Ho-Oh','Mew','Celebi',
  'Jirachi','Gardevoir','Lucario','Garchomp','Togekiss','Dragonite',
  'Gyarados','Snorlax','Arcanine','Scizor','Tyranitar','Salamence',
  'Metagross','Absol','Zoroark','Greninja','Yveltal','Xerneas',
  'Mimikyu','Incineroar','Decidueye','Primarina','Corviknight',
  'Dragapult','Cinderace','Miraidon','Koraidon','Palafin',
  'Raichu','Alakazam','Zapdos','Moltres','Articuno','Entei',
  'Suicune','Raikou','Groudon','Kyogre','Latias','Latios',
  'Darkrai','Gallade','Luxray','Toxtricity','Infernape','Empoleon',
  'Reshiram','Zekrom','Hydreigon','Volcarona','Flygon','Milotic',
  'Ninetales','Houndoom','Aggron','Lycanroc','Golisopod','Kommo-o',
];

/* Client-side search pagination state */
const search = {
  allResults:   [],
  page:         1,
  pageSize:     50,
  total:        0,     // API totalCount
  fetchingMore: false,
  uid:          0,     // incremented per search to cancel stale responses
};

let dragSourceSlot = null;   // slot id being dragged, or null

/* ----------------------------------------------------------------
   State
   ---------------------------------------------------------------- */
const state = {
  layout: 'single',          // 'single' | 'double'
  bgColor: '#3a3a3a',
  cards: {},                 // { 'left-0': { id, name, imageUrl, setName }, … }
  selectedSlot: null,        // currently open slot id
  previewCard: null,         // card shown in preview modal
};

/* ----------------------------------------------------------------
   DOM refs
   ---------------------------------------------------------------- */
const $  = (id) => document.getElementById(id);
const leftPage     = $('left-page');
const rightPage    = $('right-page');
const binderSpine  = $('binder-spine');
const layoutToggle = $('layout-toggle');
const layoutLabel  = $('layout-label');
const bgColorInput = $('bg-color');
const clearAllBtn  = $('clear-all');
const searchPanel  = $('search-panel');
const backdrop     = $('backdrop');
const spSlotLabel  = $('sp-slot-label');
const searchInput  = $('search-input');
const searchBtn    = $('search-btn');
const closeSearch  = $('close-search');
const spResults    = $('sp-results');
const filterType     = $('filter-type');
const filterEra      = $('filter-era');
const filterRarity   = $('filter-rarity');
const filterLanguage = $('filter-language');
const filterAlpha    = $('filter-alpha');
const filterDate     = $('filter-date');
const previewModal = $('preview-modal');
const previewImg   = $('preview-img');
const previewName  = $('preview-name');
const previewSet   = $('preview-set');
const closePreview = $('close-preview');
const confirmCard  = $('confirm-card');
const confirmModal = $('confirm-modal');
const confirmClear = $('confirm-clear');
const cancelClear  = $('cancel-clear');

/* ================================================================
   INIT
   ================================================================ */
function init() {
  loadState();
  buildSlots(leftPage, 'left');
  buildSlots(rightPage, 'right');
  addSpineRings();
  renderBinder();
  applyBgColor();
  attachEvents();
}

/* ----------------------------------------------------------------
   Build the 9 card slots for a page
   ---------------------------------------------------------------- */
function buildSlots(pageEl, side) {
  pageEl.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const slotId = `${side}-${i}`;
    const slot = document.createElement('div');
    slot.className = 'card-slot';
    slot.dataset.slotId = slotId;

    // Empty state icon
    slot.innerHTML = `
      <div class="slot-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="3" y="3" width="18" height="18" rx="2.5"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8"  y1="12" x2="16" y2="12"/>
        </svg>
        <span>Add Card</span>
      </div>
      <button class="remove-btn" title="Remove card" aria-label="Remove card">✕</button>
    `;

    slot.querySelector('.remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      removeCard(slotId);
    });

    slot.addEventListener('click', () => openSearch(slotId));

    // ---- Drag: source ----
    slot.addEventListener('dragstart', (e) => {
      if (!state.cards[slotId]) { e.preventDefault(); return; }
      dragSourceSlot = slotId;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', slotId);
      // rAF so the ghost image is captured before the class dims the element
      // Guard: only dim the slot if the drag is still in progress when the
      // rAF fires. Without this check, a fast drop sets dragSourceSlot=null
      // before the rAF fires, causing the class to be added after dragend
      // runs — leaving the empty slot permanently transparent.
      requestAnimationFrame(() => {
        if (dragSourceSlot === slotId) slot.classList.add('drag-source');
      });
    });

    slot.addEventListener('dragend', () => {
      // Remove from every slot as a safety net (covers the rAF edge case)
      document.querySelectorAll('.drag-source').forEach(el => el.classList.remove('drag-source'));
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      dragSourceSlot = null;
    });

    // ---- Drag: target ----
    slot.addEventListener('dragover', (e) => {
      if (!dragSourceSlot || dragSourceSlot === slotId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      slot.classList.add('drag-over');
    });

    slot.addEventListener('dragleave', (e) => {
      if (!slot.contains(e.relatedTarget)) slot.classList.remove('drag-over');
    });

    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      if (!dragSourceSlot || dragSourceSlot === slotId) return;

      const srcCard = state.cards[dragSourceSlot] || null;
      const dstCard = state.cards[slotId]          || null;

      // Swap: put destination card into source slot (or clear it)
      if (dstCard) state.cards[dragSourceSlot] = dstCard;
      else         delete state.cards[dragSourceSlot];

      // Put source card into destination slot
      if (srcCard) state.cards[slotId] = srcCard;
      else         delete state.cards[slotId];

      dragSourceSlot = null;
      saveState();
      renderBinder();
    });

    pageEl.appendChild(slot);
  }
}

/* ----------------------------------------------------------------
   Spine ring holes (3 rings)
   ---------------------------------------------------------------- */
function addSpineRings() {
  // CSS ::before and ::after provide top & bottom rings.
  // Add the middle ring as a real element.
  const mid = document.createElement('div');
  mid.className = 'ring-mid';
  mid.style.cssText = `
    position:absolute; left:50%; top:50%;
    transform:translate(-50%,-50%);
    width:14px; height:14px; border-radius:50%;
    background:#0d0d18; border:2px solid rgba(255,255,255,0.12);
  `;
  binderSpine.appendChild(mid);
}

/* ================================================================
   RENDER
   ================================================================ */
function renderBinder() {
  const isDouble = state.layout === 'double';

  rightPage.style.display   = isDouble ? 'grid' : 'none';
  binderSpine.style.display = isDouble ? 'block' : 'none';
  layoutLabel.textContent   = isDouble ? 'Two-Page Spread' : 'Single Page';

  // Update all slots
  document.querySelectorAll('.card-slot').forEach(slot => {
    const slotId = slot.dataset.slotId;

    // Skip right-page slots in single mode
    if (!isDouble && slotId.startsWith('right-')) return;

    const card = state.cards[slotId];

    // Manage card image
    let img = slot.querySelector('img');
    const emptyIcon = slot.querySelector('.slot-empty');

    if (card) {
      if (!img) {
        img = document.createElement('img');
        img.addEventListener('error', () => {
          img.src = '';
          img.style.display = 'none';
        });
        slot.insertBefore(img, slot.querySelector('.remove-btn'));
      }
      if (img.dataset.cardId !== card.id) {
        img.src = card.imageUrl;
        img.alt = card.name;
        img.dataset.cardId = card.id;
        img.style.display = '';
      }
      emptyIcon.style.display = 'none';
      slot.classList.add('has-card');
    } else {
      if (img) { img.remove(); }
      emptyIcon.style.display = 'flex';
      slot.classList.remove('has-card');
    }

    // Enable dragging only when slot has a card
    slot.draggable = !!card;

    // Selection highlight
    slot.classList.toggle('selected', state.selectedSlot === slotId);
  });
}

function applyBgColor() {
  document.documentElement.style.setProperty('--binder-bg', state.bgColor);
  bgColorInput.value = state.bgColor;
}

/* ================================================================
   SEARCH PANEL
   ================================================================ */
function openSearch(slotId) {
  state.selectedSlot = slotId;

  // Human-readable slot label
  const side  = slotId.startsWith('left') ? 'Left Page' : 'Right Page';
  const index = parseInt(slotId.split('-')[1], 10) + 1;
  const hasCard = !!state.cards[slotId];
  spSlotLabel.textContent = `${hasCard ? 'Replacing' : 'Adding to'} Slot ${index} · ${side}`;

  searchPanel.classList.add('open');
  searchPanel.setAttribute('aria-hidden', 'false');
  backdrop.classList.add('visible');
  renderBinder();

  searchInput.focus();

  // Auto-populate when field is empty and no results are showing yet
  if (!searchInput.value.trim() && !search.allResults.length) {
    populateDefault();
  }
}

function closeSearchPanel() {
  searchPanel.classList.remove('open');
  searchPanel.setAttribute('aria-hidden', 'true');
  backdrop.classList.remove('visible');
  state.selectedSlot = null;
  renderBinder();
}

/* ----------------------------------------------------------------
   Query helpers
   ---------------------------------------------------------------- */

/**
 * Normalize a raw search string and return Lucene query fragments:
 *  primary — wildcard AND query (fast, exact-ish)
 *  fuzzy   — fuzzy fallback for 1-char typos (used when primary returns 0)
 */
function buildNameQuery(raw) {
  // Strip apostrophes/punctuation that appear in card names so
  // "Turo's" and "Turos" both resolve to the same tokens.
  const cleaned = raw
    .replace(/['''`'']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').filter(w => w.length > 0);
  if (!words.length) return null;

  // Primary: each word must appear somewhere in the name (AND logic).
  // Handles multi-word ("Professor Turo") and punctuation variants.
  const primary = words.map(w => `name:*${w}*`).join(' ');

  // Fuzzy fallback: used when primary returns 0 results.
  // ~1 tolerates a single-character difference (insertion/deletion/substitution).
  // Only viable on single-word inputs; multi-word fuzzy gets too noisy.
  const fuzzy = words.length === 1 && words[0].length >= 4
    ? `name:${words[0]}~1`
    : null;

  return { primary, fuzzy };
}

/** Single pokemontcg.io API fetch, returns the raw JSON. */
async function fetchQuery(q, orderBy, page = 1, pageSize = 250) {
  const url = `${API}/cards?q=${q}&orderBy=${orderBy}`
    + `&select=id,name,images,set,rarity&pageSize=${pageSize}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/* ----------------------------------------------------------------
   Auto-populate (random popular Pokémon when search opens empty)
   ---------------------------------------------------------------- */
async function populateDefault() {
  // Pick 5 random names from the pool
  const picks = [...POPULAR_POKEMON]
    .sort(() => Math.random() - 0.5)
    .slice(0, 5);

  const namePart = picks.map(p => `name:*${p}*`).join(' OR ');
  const q = encodeURIComponent(`(${namePart})`);

  spResults.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;
  $('sp-pagination').style.display = 'none';

  try {
    const json = await fetchQuery(q, 'name', 1, 50);
    search.allResults = sortByRarity(json.data || []);
    search.page  = 1;
    search.total = search.allResults.length;
    renderPage();
  } catch {
    spResults.innerHTML = `<p class="hint-text">Type a name and press Search.</p>`;
  }
}

/* ----------------------------------------------------------------
   Main search
   ---------------------------------------------------------------- */
async function doSearch() {
  const raw    = searchInput.value.trim();
  const type   = filterType.value;
  const era    = filterEra.value;
  const rarity = filterRarity.value;
  const alpha  = filterAlpha.value;
  const date   = filterDate.value;

  // If everything is empty just show the default mix
  if (!raw && !rarity && !era && !type) {
    await populateDefault();
    return;
  }

  const nameQ = raw ? buildNameQuery(raw) : null;

  spResults.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;
  $('sp-pagination').style.display = 'none';
  searchBtn.disabled  = true;
  searchBtn.textContent = '…';

  // Tag each search so stale responses from earlier fetches are discarded
  const uid = ++search.uid;

  try {
    // ---- Build Lucene query ----
    const buildParts = (nameFragment) => {
      const parts = [];
      if (nameFragment) parts.push(nameFragment);
      if (rarity) {
        const r = rarity.includes(' ') ? `"${rarity}"` : rarity;
        parts.push(`rarity:${r}`);
      }
      if (type && TYPE_MAP[type]) parts.push(TYPE_MAP[type]);
      if (era  && ERA_MAP[era])  parts.push(ERA_MAP[era]);
      return parts.join(' ');
    };

    const primaryQ = encodeURIComponent(buildParts(nameQ?.primary || ''));

    // ---- Sort ----
    const sorts = [];
    if      (alpha === 'asc')   sorts.push('name');
    else if (alpha === 'desc')  sorts.push('-name');
    else if (date === 'newest') sorts.push('-set.releaseDate');
    else if (date === 'oldest') sorts.push('set.releaseDate');
    else                        sorts.push('name');
    const orderBy = encodeURIComponent(sorts.join(','));

    // ---- Fetch page 1 (up to 250) ----
    const json1 = await fetchQuery(primaryQ, orderBy);
    if (search.uid !== uid) return;   // a newer search started

    let results    = json1.data || [];
    const apiTotal = json1.totalCount || 0;

    // ---- Fuzzy fallback if primary returned nothing ----
    if (!results.length && nameQ?.fuzzy) {
      const fuzzyQ = encodeURIComponent(buildParts(nameQ.fuzzy));
      const jsonF  = await fetchQuery(fuzzyQ, orderBy);
      if (search.uid !== uid) return;
      results = jsonF.data || [];
    }

    // ---- Background fetch of page 2 when there are >250 total results ----
    search.allResults   = sortByRarity(results);
    search.page         = 1;
    search.total        = apiTotal;
    search.fetchingMore = apiTotal > 250 && results.length === 250;
    renderPage();

    if (search.fetchingMore) {
      fetchQuery(primaryQ, orderBy, 2, 250)
        .then(json2 => {
          if (search.uid !== uid) return;
          search.allResults   = sortByRarity([...search.allResults, ...(json2.data || [])]);
          search.fetchingMore = false;
          renderPage(false);   // stay on current page
        })
        .catch(() => { search.fetchingMore = false; updatePageInfo(); });
    }
  } catch (err) {
    if (search.uid !== uid) return;
    spResults.innerHTML = `<p class="no-results">Could not load results.<br>Check your connection and try again.</p>`;
    console.error(err);
  } finally {
    searchBtn.disabled    = false;
    searchBtn.textContent = 'Search';
  }
}

/* ----------------------------------------------------------------
   Pagination
   ---------------------------------------------------------------- */

/** Render the current page slice of search.allResults into the results list. */
function renderPage(resetToFirst = true) {
  if (resetToFirst) search.page = 1;
  const cards = search.allResults.slice(
    (search.page - 1) * search.pageSize,
    search.page * search.pageSize
  );
  renderResults(cards);
  updatePageInfo();
}

function goToPage(n) {
  const maxPage = Math.max(1, Math.ceil(search.allResults.length / search.pageSize));
  search.page = Math.max(1, Math.min(n, maxPage));
  renderPage(false);
  spResults.scrollTop = 0;
}

function updatePageInfo() {
  const paginationEl = $('sp-pagination');
  if (!search.allResults.length) {
    paginationEl.style.display = 'none';
    return;
  }

  const maxPage = Math.max(1, Math.ceil(search.allResults.length / search.pageSize));
  const shown   = Math.min(search.page * search.pageSize, search.allResults.length);
  const from    = (search.page - 1) * search.pageSize + 1;

  let infoText = `${from}–${shown} of ${search.allResults.length}`;
  if (search.fetchingMore) infoText += ' (loading more…)';
  else if (search.total > search.allResults.length)
    infoText += ` of ~${search.total} total`;

  $('page-info').textContent = infoText;
  $('page-prev').disabled    = search.page <= 1;
  $('page-next').disabled    = search.page >= maxPage && !search.fetchingMore;

  paginationEl.style.display = 'flex';
}

function sortByRarity(cards) {
  return [...cards].sort((a, b) => {
    const ra = RARITY_RANK[a.rarity] ?? 0;
    const rb = RARITY_RANK[b.rarity] ?? 0;
    return rb - ra;
  });
}

function updateFilterActiveState() {
  [filterType, filterEra, filterRarity, filterLanguage, filterAlpha, filterDate].forEach(sel => {
    sel.classList.toggle('active', sel.value !== '');
  });
}

/* ================================================================
   DOWNLOAD LAYOUT
   ================================================================ */
async function downloadLayout(format) {
  const btn = format === 'png' ? $('dl-png') : $('dl-jpg');
  const origHTML = btn.innerHTML;
  btn.textContent = '…';
  btn.disabled = true;

  try {
    const binder = document.getElementById('binder');
    const canvas = await html2canvas(binder, {
      useCORS:         true,
      allowTaint:      false,
      scale:           2,
      backgroundColor: getComputedStyle(document.documentElement)
                         .getPropertyValue('--binder-bg').trim() || '#3a3a3a',
      logging:         false,
    });

    const link      = document.createElement('a');
    link.download   = `TCGBinder.${format}`;
    link.href       = canvas.toDataURL(
      format === 'jpg' ? 'image/jpeg' : 'image/png',
      format === 'jpg' ? 0.92 : 1.0
    );
    link.click();
  } catch (err) {
    console.error('Download failed:', err);
    alert('Download failed — card images may be blocked by browser security.\nTry using your OS screenshot tool (Cmd+Shift+4 on Mac).');
  } finally {
    btn.innerHTML = origHTML;
    btn.disabled  = false;
  }
}

function renderResults(cards) {
  if (!cards.length) {
    spResults.innerHTML = `<p class="no-results">No cards found for that search.</p>`;
    return;
  }

  spResults.innerHTML = '';
  cards.forEach(card => {
    const smallImg = card.images?.small || '';
    const largeImg = card.images?.large || smallImg;
    const setName  = card.set?.name    || '';
    const rarity   = card.rarity       || '';
    const meta     = [setName, rarity].filter(Boolean).join(' · ');

    const row = document.createElement('div');
    row.className = 'result-item';

    const thumbEl = smallImg
      ? `<img class="result-thumb" src="${smallImg}" alt="${escHtml(card.name)}" loading="lazy">`
      : `<div class="result-thumb-placeholder">No Image</div>`;

    row.innerHTML = `
      ${thumbEl}
      <div class="result-info">
        <div class="result-name">${escHtml(card.name)}</div>
        <div class="result-set">${escHtml(meta)}</div>
      </div>
      <div class="result-btns">
        <button class="btn-preview">🔍 Preview</button>
        <button class="btn-add">+ Add</button>
      </div>
    `;

    const cardData = { id: card.id, name: card.name, imageUrl: largeImg, setName };

    // Click anywhere on the row to add; preview button stops propagation
    row.addEventListener('click', () => placeCard(cardData));

    row.querySelector('.btn-preview').addEventListener('click', (e) => {
      e.stopPropagation();
      openPreviewModal(cardData);
    });

    row.querySelector('.btn-add').addEventListener('click', (e) => {
      e.stopPropagation();
      placeCard(cardData);
    });

    spResults.appendChild(row);
  });
}

/* ================================================================
   PREVIEW MODAL
   ================================================================ */
function openPreviewModal(cardData) {
  state.previewCard = cardData;
  previewImg.src    = cardData.imageUrl;
  previewImg.alt    = cardData.name;
  previewName.textContent = cardData.name;
  previewSet.textContent  = cardData.setName || '';
  showModal(previewModal);
}

function closePreviewModal() {
  hideModal(previewModal);
  state.previewCard = null;
}

/* ================================================================
   CARD ACTIONS
   ================================================================ */
function placeCard(cardData) {
  if (!state.selectedSlot) return;
  state.cards[state.selectedSlot] = cardData;
  saveState();
  renderBinder();
  closeSearchPanel();
  closePreviewModal();
}

function removeCard(slotId) {
  delete state.cards[slotId];
  saveState();
  renderBinder();
}

function clearAllCards() {
  state.cards = {};
  saveState();
  renderBinder();
  hideModal(confirmModal);
}

/* ================================================================
   LAYOUT TOGGLE
   ================================================================ */
function toggleLayout() {
  state.layout = state.layout === 'single' ? 'double' : 'single';
  saveState();
  renderBinder();
}

/* ================================================================
   PERSISTENCE
   ================================================================ */
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      layout:  state.layout,
      bgColor: state.bgColor,
      cards:   state.cards,
    }));
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.layout)  state.layout  = saved.layout;
    if (saved.bgColor) state.bgColor = saved.bgColor;
    if (saved.cards)   state.cards   = saved.cards;
  } catch (e) {
    console.warn('Could not load saved state:', e);
  }
}

/* ================================================================
   MODAL HELPERS
   ================================================================ */
function showModal(el) {
  el.classList.add('visible');
}
function hideModal(el) {
  el.classList.remove('visible');
}

/* ================================================================
   EVENTS
   ================================================================ */
function attachEvents() {

  // Layout toggle
  layoutToggle.addEventListener('click', toggleLayout);

  // Background color
  bgColorInput.addEventListener('input', (e) => {
    state.bgColor = e.target.value;
    applyBgColor();
    saveState();
  });

  // Clear all — open confirm
  clearAllBtn.addEventListener('click', () => showModal(confirmModal));
  confirmClear.addEventListener('click', clearAllCards);
  cancelClear.addEventListener('click', () => hideModal(confirmModal));
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) hideModal(confirmModal);
  });

  // Search panel
  closeSearch.addEventListener('click', closeSearchPanel);
  backdrop.addEventListener('click', closeSearchPanel);

  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  $('page-prev').addEventListener('click', () => goToPage(search.page - 1));
  $('page-next').addEventListener('click', () => goToPage(search.page + 1));

  // Download buttons
  $('dl-png').addEventListener('click', () => downloadLayout('png'));
  $('dl-jpg').addEventListener('click', () => downloadLayout('jpg'));

  // Filters: mark active state; alpha & date are mutually exclusive
  filterType.addEventListener('change', updateFilterActiveState);
  filterEra.addEventListener('change', updateFilterActiveState);
  filterRarity.addEventListener('change', updateFilterActiveState);
  filterLanguage.addEventListener('change', updateFilterActiveState);
  filterAlpha.addEventListener('change', () => {
    if (filterAlpha.value) filterDate.value = '';
    updateFilterActiveState();
  });
  filterDate.addEventListener('change', () => {
    if (filterDate.value) filterAlpha.value = '';
    updateFilterActiveState();
  });

  // Preview modal
  closePreview.addEventListener('click', closePreviewModal);
  confirmCard.addEventListener('click', () => {
    if (state.previewCard) placeCard(state.previewCard);
  });
  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) closePreviewModal();
  });

  // Keyboard: Escape closes panels/modals
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (previewModal.classList.contains('visible')) { closePreviewModal(); return; }
    if (confirmModal.classList.contains('visible')) { hideModal(confirmModal); return; }
    if (searchPanel.classList.contains('open'))     { closeSearchPanel(); }
  });
}

/* ================================================================
   UTILITY
   ================================================================ */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---- Start ---- */
init();
