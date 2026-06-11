/* ================================================================
   binder.js — My Binder page
   ================================================================ */
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyCZ4Ul9RLxH9Uf6MEDRDnrlCXmaNomE1vw',
  authDomain:        'tcgbinder-f3a18.firebaseapp.com',
  projectId:         'tcgbinder-f3a18',
  storageBucket:     'tcgbinder-f3a18.firebasestorage.app',
  messagingSenderId: '107975817219',
  appId:             '1:107975817219:web:1e1c7b3ab405d03bfb3636',
};

if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
const fbAuth = firebase.auth();
const fbDb   = firebase.firestore();

const $ = (id) => document.getElementById(id);

/* ---- State ---- */
let currentUser   = null;
let currentBinder = null;    // { id, name, coverCardUrl } when inside a binder
let pendingDeleteBinder = null;
let pendingDeleteLayout = null;
let pendingRenameBinder = null;
let pendingRenameLayout = null;
let pendingLoadLayout   = null;  // { binderId, layoutId, layoutData, layoutName }
let pendingCoverBinder  = null;  // { id, name } for cover picker

/* ================================================================
   DARK MODE
   ================================================================ */
(function () {
  const DARK_KEY = 'tcgbinder_dark';
  try { if (localStorage.getItem(DARK_KEY) === '1') document.body.classList.add('dark-mode'); } catch (e) {}
  const btn = document.getElementById('dark-mode-btn');
  if (btn) btn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    try { localStorage.setItem(DARK_KEY, isDark ? '1' : '0'); } catch (e) {}
  });
})();

/* ================================================================
   AUTH
   ================================================================ */
fbAuth.onAuthStateChanged(user => {
  if (!user) { window.location.href = 'index.html'; return; }
  currentUser = user;
  initProfileArea(user);
  loadBinders();
});

/* ================================================================
   PROFILE AREA (header)
   ================================================================ */
function initProfileArea(user) {
  $('profile-area').style.display = 'flex';
  fbDb.collection('users').doc(user.uid).get().then(snap => {
    setAvatar(user, snap.exists ? snap.data() : null);
  }).catch(() => setAvatar(user, null));

  $('profile-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const dd = $('profile-dropdown');
    const open = dd.hidden;
    dd.hidden = !open;
    $('profile-btn').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', () => {
    $('profile-dropdown').hidden = true;
    $('profile-btn').setAttribute('aria-expanded', 'false');
  });
  $('sign-out-btn').addEventListener('click', () => {
    fbAuth.signOut().then(() => { window.location.href = 'index.html'; });
  });
}

function setAvatar(user, data) {
  const av = $('profile-avatar');
  if (data?.photoData) {
    av.style.backgroundImage = `url(${data.photoData})`;
    av.textContent = '';
    av.classList.add('has-photo');
  } else {
    av.style.backgroundImage = '';
    const name = data?.username || user.displayName || user.email || '?';
    av.textContent = name[0].toUpperCase();
    av.classList.remove('has-photo');
  }
}

/* ================================================================
   MODAL HELPERS
   ================================================================ */
function showModal(id)  { $(id).classList.remove('hidden'); }
function hideModal(id)  { $(id).classList.add('hidden'); }

function closeAll() {
  ['create-binder-modal','rename-binder-modal','rename-layout-modal',
   'delete-binder-modal','delete-layout-modal','layout-preview-modal',
   'load-confirm-modal','cover-picker-modal'].forEach(hideModal);
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

/* ================================================================
   BINDERS LIST
   ================================================================ */
async function loadBinders() {
  showLoading(true);
  try {
    const snap = await fbDb.collection('users').doc(currentUser.uid)
      .collection('binders').orderBy('createdAt').get();
    renderBindersView(snap.docs);
  } catch {
    renderBindersView([]);
  }
  showLoading(false);
}

function renderBindersView(docs) {
  $('binders-view').style.display = '';
  $('layouts-view').style.display  = 'none';
  currentBinder = null;

  const grid = $('binders-grid');
  grid.innerHTML = '';

  if (docs.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <p>No binders yet.<br>Create one to start saving your layouts.</p>
      </div>`;
  } else {
    docs.forEach(doc => {
      const data = doc.data();
      const card = makeBinderCard(doc.id, data);
      grid.appendChild(card);
    });
  }

  // + New Binder card
  const newCard = document.createElement('div');
  newCard.className = 'new-binder-card';
  newCard.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
    New Binder`;
  newCard.addEventListener('click', () => {
    $('create-binder-name').value = '';
    $('create-binder-error').textContent = '';
    showModal('create-binder-modal');
    setTimeout(() => $('create-binder-name').focus(), 50);
  });
  grid.appendChild(newCard);
}

function makeBinderCard(id, data) {
  const thumbContent = data.coverCardUrl
    ? `<img src="${escHtml(data.coverCardUrl)}" alt="${escHtml(data.name)}" loading="lazy" class="binder-cover-img">`
    : `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.25">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
       </svg>`;

  const card = document.createElement('div');
  card.className = 'binder-card';
  card.innerHTML = `
    <div class="binder-card-thumb">
      ${thumbContent}
      <div class="binder-open-overlay">Open</div>
    </div>
    <div class="binder-card-info">
      <div class="binder-card-name">${escHtml(data.name)}</div>
      <div class="binder-card-meta" id="meta-${id}">Loading…</div>
    </div>
    <div class="binder-card-actions icon-actions">
      <button class="btn-card-cover" title="Set Cover" aria-label="Set Cover">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </button>
      <button class="btn-card-rename" title="Rename" aria-label="Rename">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="btn-card-delete" title="Delete" aria-label="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>`;

  card.addEventListener('click', () => openBinder(id, data.name, data.coverCardUrl));
  card.querySelector('.btn-card-cover').addEventListener('click',  (e) => { e.stopPropagation(); openCoverPicker(id, data.name, data.coverCardUrl); });
  card.querySelector('.btn-card-rename').addEventListener('click', (e) => { e.stopPropagation(); startRenameBinder(id, data.name); });
  card.querySelector('.btn-card-delete').addEventListener('click', (e) => { e.stopPropagation(); startDeleteBinder(id, data.name); });

  // Load layout count async
  fbDb.collection('users').doc(currentUser.uid)
    .collection('binders').doc(id).collection('layouts').get()
    .then(s => {
      const meta = $(`meta-${id}`);
      if (meta) meta.textContent = `${s.size} layout${s.size !== 1 ? 's' : ''}`;
    }).catch(() => {});

  return card;
}

/* ================================================================
   OPEN BINDER → LAYOUTS
   ================================================================ */
async function openBinder(binderId, binderName, coverCardUrl) {
  showLoading(true);
  currentBinder = { id: binderId, name: binderName, coverCardUrl: coverCardUrl || null };
  try {
    const snap = await fbDb.collection('users').doc(currentUser.uid)
      .collection('binders').doc(binderId)
      .collection('layouts').orderBy('createdAt').get();
    renderLayoutsView(snap.docs, binderName);
  } catch {
    renderLayoutsView([], binderName);
  }
  showLoading(false);
}

function renderLayoutsView(docs, binderName) {
  $('binders-view').style.display = 'none';
  $('layouts-view').style.display = '';
  $('current-binder-name').textContent  = binderName;
  $('layouts-binder-title').textContent = binderName;

  const grid = $('layouts-grid');
  grid.innerHTML = '';

  if (docs.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <p>No layouts in this binder yet.<br>Save a layout from the main app.</p>
      </div>`;
  } else {
    docs.forEach(doc => {
      const card = makeLayoutCard(doc.id, doc.data());
      grid.appendChild(card);
    });
  }
}

function makeLayoutCard(id, data) {
  const card = document.createElement('div');
  card.className = 'binder-card';

  const dateStr = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
    : '';
  const cardCount = Object.keys(data.cards || {}).length;

  // Thumb
  const thumbDiv = document.createElement('div');
  thumbDiv.className = 'binder-card-thumb';
  thumbDiv.style.cursor = 'pointer';
  if (data.thumbnailUrl) {
    const img = document.createElement('img');
    img.src = data.thumbnailUrl;
    img.alt = data.name;
    thumbDiv.appendChild(img);
  } else {
    // Mini grid
    const cards = Object.values(data.cards || {}).slice(0, 9);
    const miniGrid = document.createElement('div');
    miniGrid.className = 'binder-card-mini-grid';
    for (let i = 0; i < 9; i++) {
      if (cards[i]?.imageUrl) {
        const img = document.createElement('img');
        img.src = cards[i].imageUrl;
        img.loading = 'lazy';
        miniGrid.appendChild(img);
      } else {
        const empty = document.createElement('div');
        empty.className = 'mini-empty';
        miniGrid.appendChild(empty);
      }
    }
    thumbDiv.appendChild(miniGrid);
  }
  thumbDiv.addEventListener('click', () => previewLayout(id, data));

  card.innerHTML = `
    <div class="binder-card-info">
      <div class="binder-card-name">${escHtml(data.name)}</div>
      <div class="binder-card-meta">${dateStr} · ${cardCount} card${cardCount !== 1 ? 's' : ''} · ${data.layout === 'double' ? 'Double' : 'Single'} page</div>
    </div>
    <div class="binder-card-actions icon-actions">
      <button class="btn-card-open" title="Preview" aria-label="Preview">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
      <button class="btn-card-cover" title="Set as Binder Cover" aria-label="Set as Binder Cover">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </button>
      <button class="btn-card-rename" title="Rename" aria-label="Rename">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="btn-card-delete" title="Delete" aria-label="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>`;

  card.insertBefore(thumbDiv, card.firstChild);

  card.querySelector('.btn-card-open').addEventListener('click',   () => previewLayout(id, data));
  card.querySelector('.btn-card-cover').addEventListener('click',  (e) => { e.stopPropagation(); openCoverPicker(currentBinder.id, currentBinder.name, currentBinder.coverCardUrl); });
  card.querySelector('.btn-card-rename').addEventListener('click', (e) => { e.stopPropagation(); startRenameLayout(id, data.name); });
  card.querySelector('.btn-card-delete').addEventListener('click', (e) => { e.stopPropagation(); startDeleteLayout(id, data.name); });

  return card;
}

/* ================================================================
   LAYOUT PREVIEW
   ================================================================ */
function previewLayout(layoutId, data) {
  $('preview-layout-name').textContent = data.name;
  const dateStr = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString(undefined, { month:'long', day:'numeric', year:'numeric' })
    : '';
  const cardCount = Object.keys(data.cards || {}).length;
  $('preview-layout-meta').textContent =
    `${dateStr} · ${cardCount} card${cardCount !== 1 ? 's' : ''} · ${data.layout === 'double' ? 'Double' : 'Single'} page`;

  // Build preview grid
  const grid = $('preview-layout-grid');
  grid.innerHTML = '';
  const cols = data.layout === 'double' ? 6 : 3;
  const total = cols * 3;
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.backgroundColor = data.bgColor || '#3a3a3a';

  for (let i = 0; i < total; i++) {
    const side = i < 9 ? 'left' : 'right';
    const idx  = i < 9 ? i : i - 9;
    const slotKey = `${side}-${idx}`;
    const card = data.cards?.[slotKey];
    const slot = document.createElement('div');
    slot.className = 'layout-preview-slot';
    if (card?.imageUrl) {
      const img = document.createElement('img');
      img.src = card.imageUrl;
      img.loading = 'lazy';
      slot.appendChild(img);
    }
    grid.appendChild(slot);
  }

  pendingLoadLayout = { binderId: currentBinder.id, layoutId, layoutData: data, layoutName: data.name };
  showModal('layout-preview-modal');
}

/* ================================================================
   LOAD LAYOUT → INDEX
   ================================================================ */
function doLoadLayout() {
  if (!pendingLoadLayout) return;
  sessionStorage.setItem('tcgbinder_load', JSON.stringify(pendingLoadLayout));
  window.location.href = 'index.html';
}

/* ================================================================
   CREATE BINDER
   ================================================================ */
$('close-create-binder').addEventListener('click', () => hideModal('create-binder-modal'));
$('create-binder-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('confirm-create-binder').click(); });
$('confirm-create-binder').addEventListener('click', async () => {
  const name = $('create-binder-name').value.trim();
  if (!name) { $('create-binder-error').textContent = 'Please enter a name.'; return; }
  const btn = $('confirm-create-binder');
  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    await fbDb.collection('users').doc(currentUser.uid).collection('binders').add({
      name, createdAt: new Date().toISOString(),
    });
    hideModal('create-binder-modal');
    loadBinders();
  } catch {
    $('create-binder-error').textContent = 'Failed to create binder.';
  } finally {
    btn.disabled = false; btn.textContent = 'Create Binder';
  }
});

/* ================================================================
   RENAME BINDER
   ================================================================ */
function startRenameBinder(id, name) {
  pendingRenameBinder = id;
  $('rename-binder-input').value = name;
  $('rename-binder-error').textContent = '';
  showModal('rename-binder-modal');
  setTimeout(() => $('rename-binder-input').focus(), 50);
}
$('close-rename-binder').addEventListener('click', () => hideModal('rename-binder-modal'));
$('rename-binder-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('confirm-rename-binder').click(); });
$('confirm-rename-binder').addEventListener('click', async () => {
  const name = $('rename-binder-input').value.trim();
  if (!name) { $('rename-binder-error').textContent = 'Please enter a name.'; return; }
  const btn = $('confirm-rename-binder');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await fbDb.collection('users').doc(currentUser.uid)
      .collection('binders').doc(pendingRenameBinder).update({ name });
    hideModal('rename-binder-modal');
    loadBinders();
  } catch {
    $('rename-binder-error').textContent = 'Failed to rename.';
  } finally {
    btn.disabled = false; btn.textContent = 'Rename';
  }
});

/* ================================================================
   DELETE BINDER
   ================================================================ */
function startDeleteBinder(id, name) {
  pendingDeleteBinder = id;
  $('delete-binder-desc').textContent =
    `"${name}" and all its layouts will be permanently deleted. This cannot be undone.`;
  showModal('delete-binder-modal');
}
$('cancel-delete-binder').addEventListener('click', () => hideModal('delete-binder-modal'));
$('confirm-delete-binder').addEventListener('click', async () => {
  const btn = $('confirm-delete-binder');
  btn.disabled = true; btn.textContent = 'Deleting…';
  try {
    // Delete all layouts in binder first
    const layoutsSnap = await fbDb.collection('users').doc(currentUser.uid)
      .collection('binders').doc(pendingDeleteBinder).collection('layouts').get();
    const batch = fbDb.batch();
    layoutsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(fbDb.collection('users').doc(currentUser.uid)
      .collection('binders').doc(pendingDeleteBinder));
    await batch.commit();
    hideModal('delete-binder-modal');
    loadBinders();
  } catch {
    alert('Failed to delete binder. Please try again.');
  } finally {
    btn.disabled = false; btn.textContent = 'Delete';
  }
});

/* ================================================================
   RENAME LAYOUT
   ================================================================ */
function startRenameLayout(id, name) {
  pendingRenameLayout = id;
  $('rename-layout-input').value = name;
  $('rename-layout-error').textContent = '';
  showModal('rename-layout-modal');
  setTimeout(() => $('rename-layout-input').focus(), 50);
}
$('close-rename-layout').addEventListener('click', () => hideModal('rename-layout-modal'));
$('rename-layout-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('confirm-rename-layout').click(); });
$('confirm-rename-layout').addEventListener('click', async () => {
  const name = $('rename-layout-input').value.trim();
  if (!name) { $('rename-layout-error').textContent = 'Please enter a name.'; return; }
  const btn = $('confirm-rename-layout');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await fbDb.collection('users').doc(currentUser.uid)
      .collection('binders').doc(currentBinder.id)
      .collection('layouts').doc(pendingRenameLayout).update({ name });
    hideModal('rename-layout-modal');
    openBinder(currentBinder.id, currentBinder.name);
  } catch {
    $('rename-layout-error').textContent = 'Failed to rename.';
  } finally {
    btn.disabled = false; btn.textContent = 'Rename';
  }
});

/* ================================================================
   DELETE LAYOUT
   ================================================================ */
function startDeleteLayout(id, name) {
  pendingDeleteLayout = id;
  showModal('delete-layout-modal');
}
$('cancel-delete-layout').addEventListener('click', () => hideModal('delete-layout-modal'));
$('confirm-delete-layout').addEventListener('click', async () => {
  const btn = $('confirm-delete-layout');
  btn.disabled = true; btn.textContent = 'Deleting…';
  try {
    await fbDb.collection('users').doc(currentUser.uid)
      .collection('binders').doc(currentBinder.id)
      .collection('layouts').doc(pendingDeleteLayout).delete();
    hideModal('delete-layout-modal');
    openBinder(currentBinder.id, currentBinder.name);
  } catch {
    alert('Failed to delete layout.');
  } finally {
    btn.disabled = false; btn.textContent = 'Delete';
  }
});

/* ================================================================
   BINDER COVER PICKER
   ================================================================ */
async function openCoverPicker(binderId, binderName, currentCoverUrl) {
  pendingCoverBinder = { id: binderId, name: binderName };

  $('cover-picker-title').textContent = `Set Cover — ${binderName}`;

  if (currentCoverUrl) {
    $('cover-current-img').src = currentCoverUrl;
    $('cover-current-section').style.display = '';
  } else {
    $('cover-current-section').style.display = 'none';
  }

  $('cover-loading').style.display = 'flex';
  $('cover-cards-container').style.display = 'none';
  $('cover-empty').style.display = 'none';
  showModal('cover-picker-modal');

  try {
    const snap = await fbDb.collection('users').doc(currentUser.uid)
      .collection('binders').doc(binderId)
      .collection('layouts').orderBy('createdAt').get();

    const container = $('cover-cards-container');
    container.innerHTML = '';
    let totalCards = 0;

    snap.docs.forEach(doc => {
      const layout = doc.data();
      const cards = Object.values(layout.cards || {}).filter(c => c?.imageUrl);
      if (cards.length === 0) return;
      totalCards += cards.length;

      const section = document.createElement('div');
      section.className = 'cover-layout-section';
      section.innerHTML = `<div class="cover-layout-label">${escHtml(layout.name)}</div>`;

      const grid = document.createElement('div');
      grid.className = 'cover-card-grid';

      cards.forEach(card => {
        const tile = document.createElement('div');
        tile.className = 'thumb-tile' + (card.imageUrl === currentCoverUrl ? ' selected' : '');
        const img = document.createElement('img');
        img.src = card.imageUrl;
        img.alt = card.name || '';
        img.loading = 'lazy';
        tile.appendChild(img);
        tile.addEventListener('click', () => setCoverCard(card.imageUrl));
        grid.appendChild(tile);
      });

      section.appendChild(grid);
      container.appendChild(section);
    });

    $('cover-loading').style.display = 'none';
    if (totalCards === 0) {
      $('cover-empty').style.display = '';
    } else {
      container.style.display = '';
    }
  } catch (e) {
    $('cover-loading').style.display = 'none';
    $('cover-empty').textContent = 'Failed to load cards. Please try again.';
    $('cover-empty').style.display = '';
  }
}

async function setCoverCard(imageUrl) {
  if (!pendingCoverBinder) return;
  try {
    await fbDb.collection('users').doc(currentUser.uid)
      .collection('binders').doc(pendingCoverBinder.id)
      .update({ coverCardUrl: imageUrl });
    if (currentBinder?.id === pendingCoverBinder.id) {
      currentBinder.coverCardUrl = imageUrl;
    }
    hideModal('cover-picker-modal');
    loadBinders();
  } catch (e) {
    alert('Failed to set cover. Please try again.');
  }
}

async function removeCover() {
  if (!pendingCoverBinder) return;
  const btn = $('remove-cover-btn');
  btn.disabled = true; btn.textContent = 'Removing…';
  try {
    await fbDb.collection('users').doc(currentUser.uid)
      .collection('binders').doc(pendingCoverBinder.id)
      .update({ coverCardUrl: firebase.firestore.FieldValue.delete() });
    if (currentBinder?.id === pendingCoverBinder.id) {
      currentBinder.coverCardUrl = null;
    }
    hideModal('cover-picker-modal');
    loadBinders();
  } catch (e) {
    alert('Failed to remove cover. Please try again.');
  } finally {
    btn.disabled = false; btn.textContent = 'Remove Cover';
  }
}

$('close-cover-picker').addEventListener('click', () => hideModal('cover-picker-modal'));
$('remove-cover-btn').addEventListener('click', removeCover);

/* ================================================================
   RENAME CURRENT BINDER (in-view button)
   ================================================================ */
$('rename-binder-btn').addEventListener('click', () => {
  if (currentBinder) startRenameBinder(currentBinder.id, currentBinder.name);
});

/* ================================================================
   BACK TO BINDERS
   ================================================================ */
$('back-to-binders').addEventListener('click', e => { e.preventDefault(); loadBinders(); });

/* ================================================================
   LAYOUT PREVIEW MODAL ACTIONS
   ================================================================ */
$('close-layout-preview').addEventListener('click', () => hideModal('layout-preview-modal'));
$('cancel-load-layout-btn').addEventListener('click', () => hideModal('layout-preview-modal'));
$('load-layout-btn').addEventListener('click', () => {
  hideModal('layout-preview-modal');
  showModal('load-confirm-modal');
});

$('cancel-load-confirm').addEventListener('click', () => hideModal('load-confirm-modal'));
$('confirm-load-confirm').addEventListener('click', doLoadLayout);

/* ================================================================
   UTILITY
   ================================================================ */
function showLoading(show) {
  $('page-loading').style.display = show ? 'flex' : 'none';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
