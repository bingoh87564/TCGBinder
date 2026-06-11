/* ================================================================
   PokéTopia — app.js
   ================================================================ */

const API = 'https://api.pokemontcg.io/v2';
const STORAGE_KEY = 'poketopia_v1';

/* ================================================================
   FIREBASE CONFIGURATION
   1. Go to https://console.firebase.google.com
   2. Create a project → Add a web app → copy the config below
   3. In Authentication → Sign-in method, enable Email/Password and Google
   ================================================================ */
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyCZ4Ul9RLxH9Uf6MEDRDnrlCXmaNomE1vw',
  authDomain:        'tcgbinder-f3a18.firebaseapp.com',
  projectId:         'tcgbinder-f3a18',
  storageBucket:     'tcgbinder-f3a18.firebasestorage.app',
  messagingSenderId: '107975817219',
  appId:             '1:107975817219:web:1e1c7b3ab405d03bfb3636',
};

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
let currentUser    = null;   // currently signed-in Firebase user

/* Touch drag state (mobile only) */
let touchDragSrc = null;
let touchGhost   = null;
let touchDstSlot = null;

/* ----------------------------------------------------------------
   State
   ---------------------------------------------------------------- */
const state = {
  layout:        'single',   // 'single' | 'double'
  bgColor:       '#3a3a3a',
  bgTransparent: false,      // true = transparent PNG export; shows checkerboard in UI
  cards:         {},         // { 'left-0': { id, name, imageUrl, setName }, … }
  selectedSlot:  null,       // currently open slot id
  previewCard:   null,       // card shown in preview modal
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
   EMAILJS CONFIGURATION
   1. Sign up at https://emailjs.com  (free: 200 emails/month)
   2. Add an Email Service (Gmail, Outlook, etc.)
   3. Create a Template — use these variables in the body:
        {{to_name}}          — the recipient's username
        {{verification_code}} — the 6-digit code
      Set "To Email" field to: {{to_email}}
   4. Copy your Public Key from Account → API Keys
   ================================================================ */
const EMAILJS_CONFIG = {
  publicKey:  'wjxGGsNMJwPCp3EuH',
  serviceId:  'service_i61e20a',
  templateId: 'template_85nqjka',
};

/* ================================================================
   AUTH — module-level state
   ================================================================ */
let pendingReg     = null;   // { email, username, password } held during code verification
let verif          = null;   // { code, expiresAt }
let countdownTimer = null;
let fbDb           = null;   // Firestore instance (initialised in bootstrap)
let pendingSave      = false;  // true when an unauthenticated user triggered Save to Binder
let loadedLayoutRef  = null;   // { binderId, layoutId, layoutName } when a layout was loaded from the binder page

/* ================================================================
   AUTH — view & error helpers
   ================================================================ */
function showAuthView(name) {
  ['signin', 'register', 'reset', 'verify'].forEach(v => {
    $('view-' + v).style.display = v === name ? '' : 'none';
  });
}

function friendlyAuthError(code) {
  return ({
    'auth/invalid-email':          'Invalid email address.',
    'auth/user-not-found':         'No account found for this email.',
    'auth/wrong-password':         'Incorrect password.',
    'auth/invalid-credential':     'Incorrect email or password.',
    'auth/email-already-in-use':   'An account already exists for this email.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/too-many-requests':      'Too many attempts — try again later.',
    'auth/popup-closed-by-user':   'Sign-in was cancelled.',
    'auth/popup-blocked':          'Popup blocked — allow popups for this site.',
    'auth/network-request-failed': 'Network error — check your connection.',
  })[code] || 'Something went wrong. Please try again.';
}

/* ================================================================
   AUTH — registration validation
   ================================================================ */
function validatePassword(pw) {
  return {
    len:     pw.length >= 8,
    upper:   /[A-Z]/.test(pw),
    lower:   /[a-z]/.test(pw),
    num:     /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}
function allPwdReqsMet(pw) {
  const v = validatePassword(pw);
  return v.len && v.upper && v.lower && v.num && v.special;
}
function updatePwdReqs(pw) {
  const v = validatePassword(pw);
  $('req-len').classList.toggle('met', v.len);
  $('req-upper').classList.toggle('met', v.upper);
  $('req-lower').classList.toggle('met', v.lower);
  $('req-num').classList.toggle('met', v.num);
  $('req-special').classList.toggle('met', v.special);
}
function validateAge(birthdayStr) {
  if (!birthdayStr) return false;
  const today = new Date();
  const bday  = new Date(birthdayStr);
  let age = today.getFullYear() - bday.getFullYear();
  const m = today.getMonth() - bday.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bday.getDate())) age--;
  return age >= 13;
}

/* ================================================================
   AUTH — username uniqueness (Firestore)
   ================================================================ */
async function isUsernameTaken(username) {
  if (!fbDb) return false;
  try {
    const snap = await fbDb.collection('usernames').doc(username.toLowerCase()).get();
    return snap.exists;
  } catch { return false; }
}
async function reserveUsername(username, uid) {
  if (!fbDb) return;
  const batch = fbDb.batch();
  batch.set(fbDb.collection('usernames').doc(username.toLowerCase()), { uid });
  batch.set(fbDb.collection('users').doc(uid), {
    username,
    email:     pendingReg.email,
    createdAt: new Date().toISOString(),
  });
  await batch.commit();
}

/* ================================================================
   AUTH — email verification code lifecycle
   ================================================================ */
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function startCountdown() {
  clearInterval(countdownTimer);
  const el = $('verify-timer');
  function tick() {
    if (!verif) { clearInterval(countdownTimer); return; }
    const ms = verif.expiresAt - Date.now();
    if (ms <= 0) {
      clearInterval(countdownTimer);
      el.textContent = 'Code has expired — please request a new one.';
      el.className   = 'verify-timer expired';
      return;
    }
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    el.textContent = `Expires in ${m}:${s.toString().padStart(2, '0')}`;
    el.className   = 'verify-timer' + (ms < 60000 ? ' expiring' : '');
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function clearVerifState() {
  clearInterval(countdownTimer);
  countdownTimer = null;
  verif          = null;
  pendingReg     = null;
}

async function sendCode() {
  const code = generateCode();
  verif = { code, expiresAt: Date.now() + 5 * 60 * 1000 };

  const ejsReady = EMAILJS_CONFIG.publicKey && !EMAILJS_CONFIG.publicKey.startsWith('YOUR_');
  if (ejsReady) {
    await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      { to_email: pendingReg.email, to_name: pendingReg.username, verification_code: code },
      EMAILJS_CONFIG.publicKey,
    );
  } else {
    // Dev fallback — code visible in the browser console
    console.info(`[TCGBinder dev] Verification code for ${pendingReg.email}: ${code}`);
    $('verify-hint').textContent = 'EmailJS not configured — see browser console for the code.';
  }
}

async function startVerification(regData) {
  pendingReg = regData;
  await sendCode();
  if (EMAILJS_CONFIG.publicKey && !EMAILJS_CONFIG.publicKey.startsWith('YOUR_')) {
    $('verify-hint').textContent = `Enter the 6-digit code sent to ${pendingReg.email}.`;
  }
  clearCodeInputs();
  showAuthView('verify');
  startCountdown();
}

function clearCodeInputs() {
  document.querySelectorAll('.code-input').forEach(i => { i.value = ''; i.classList.remove('filled'); });
  setTimeout(() => { const f = document.querySelector('.code-input'); if (f) f.focus(); }, 50);
}
function getEnteredCode() {
  return Array.from(document.querySelectorAll('.code-input')).map(i => i.value).join('');
}

/* ================================================================
   AUTH — modal open / close
   ================================================================ */
function openAuthModal() {
  showAuthView('signin');
  $('auth-overlay').classList.add('visible');
}

function closeAuthModal() {
  $('auth-overlay').classList.remove('visible');
  pendingSave = false;
  clearVerifState();
  showAuthView('signin');
  [['si-btn','Sign In'], ['reg-btn','Send Verification Code'], ['rst-btn','Send Reset Email']]
    .forEach(([id, label]) => { const b = $(id); if (b) { b.disabled = false; b.textContent = label; } });
}

/* ================================================================
   AUTH — state handler
   ================================================================ */
function setProfileAvatar(user, userData) {
  const avatar = $('profile-avatar');
  if (!avatar) return;
  if (userData?.photoData) {
    avatar.style.backgroundImage = `url(${userData.photoData})`;
    avatar.textContent = '';
    avatar.classList.add('has-photo');
  } else {
    avatar.style.backgroundImage = '';
    const name = userData?.username || user.displayName || user.email || '?';
    avatar.textContent = name[0].toUpperCase();
    avatar.classList.remove('has-photo');
  }
}

function handleAuthState(user) {
  if (user) {
    currentUser = user;
    closeAuthModal();
    $('profile-area').style.display = 'flex';
    $('signin-btn').style.display   = 'none';
    loadState();
    renderBinder();
    applyBgColor();
    // Load user profile data for avatar
    if (fbDb) {
      fbDb.collection('users').doc(user.uid).get().then(snap => {
        setProfileAvatar(user, snap.exists ? snap.data() : null);
      }).catch(() => setProfileAvatar(user, null));
    } else {
      setProfileAvatar(user, null);
    }
    // Check if a layout was queued for loading (from binder page)
    const pending = sessionStorage.getItem('tcgbinder_load');
    if (pending) {
      sessionStorage.removeItem('tcgbinder_load');
      try {
        const { binderId, layoutId, layoutData, layoutName } = JSON.parse(pending);
        const doLoad = () => {
          state.layout        = layoutData.layout        || 'single';
          state.bgColor       = layoutData.bgColor       || '#3a3a3a';
          state.bgTransparent = !!layoutData.bgTransparent;
          state.cards         = layoutData.cards         || {};
          loadedLayoutRef     = { binderId, layoutId, layoutName };
          saveState(); renderBinder(); applyBgColor();
        };
        if (Object.keys(state.cards).length > 0) {
          $('load-layout-desc').textContent =
            `Loading "${layoutName}" will replace your current binder. Continue?`;
          showModal($('load-layout-modal'));
          $('confirm-load-layout').onclick = () => { hideModal($('load-layout-modal')); doLoad(); };
          $('cancel-load-layout').onclick  = () => hideModal($('load-layout-modal'));
        } else {
          doLoad();
        }
      } catch {}
    }
    // If the user logged in because they wanted to save, open the save modal now
    if (pendingSave) {
      pendingSave = false;
      openSaveLayoutModal();
    }
  } else {
    currentUser     = null;
    loadedLayoutRef = null;
    $('profile-area').style.display = 'none';
    $('signin-btn').style.display   = '';
    clearVerifState();
    showAuthView('signin');
    [['si-btn','Sign In'], ['reg-btn','Send Verification Code'], ['rst-btn','Send Reset Email']]
      .forEach(([id, label]) => { const b = $(id); if (b) { b.disabled = false; b.textContent = label; } });
    loadState();
    renderBinder();
    applyBgColor();
  }
}

/* ================================================================
   AUTH — event wiring
   ================================================================ */
function attachAuthEvents(fbAuth) {

  // ---- Sign in with email ----
  $('si-btn').addEventListener('click', () => {
    $('si-error').textContent = '';
    $('si-btn').disabled = true;
    $('si-btn').textContent = '…';
    fbAuth.signInWithEmailAndPassword($('si-email').value.trim(), $('si-password').value)
      .catch(err => {
        $('si-error').textContent = friendlyAuthError(err.code);
        $('si-btn').disabled = false;
        $('si-btn').textContent = 'Sign In';
      });
  });
  $('si-email').addEventListener('keydown',    e => { if (e.key === 'Enter') $('si-password').focus(); });
  $('si-password').addEventListener('keydown', e => { if (e.key === 'Enter') $('si-btn').click(); });

  // ---- Sign in with Google ----
  $('google-btn').addEventListener('click', () => {
    $('si-error').textContent = '';
    fbAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
      .catch(err => { $('si-error').textContent = friendlyAuthError(err.code); });
  });

  // ---- Navigation ----
  $('go-register').addEventListener('click',   e => { e.preventDefault(); showAuthView('register'); });
  $('go-reset').addEventListener('click',      e => { e.preventDefault(); showAuthView('reset');    });
  $('go-signin-reg').addEventListener('click', e => { e.preventDefault(); showAuthView('signin');   });
  $('go-signin-rst').addEventListener('click', e => { e.preventDefault(); showAuthView('signin');   });

  // ---- Registration: live password requirements ----
  $('reg-password').addEventListener('input', () => updatePwdReqs($('reg-password').value));

  // ---- Registration: enforce 13+ max on birthday picker ----
  const maxBday = new Date();
  maxBday.setFullYear(maxBday.getFullYear() - 13);
  $('reg-birthday').max = maxBday.toISOString().split('T')[0];

  // ---- Registration: validate → check username uniqueness → send code ----
  $('reg-btn').addEventListener('click', async () => {
    const email    = $('reg-email').value.trim();
    const username = $('reg-username').value.trim();
    const password = $('reg-password').value;
    const confirm  = $('reg-confirm').value;
    const birthday = $('reg-birthday').value;
    $('reg-error').textContent = '';

    if (!email || !username || !password || !confirm || !birthday) {
      $('reg-error').textContent = 'Please fill in all fields.'; return;
    }
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      $('reg-error').textContent = 'Username must be 3–20 characters using only letters, numbers, _ or -.'; return;
    }
    if (!allPwdReqsMet(password)) {
      $('reg-error').textContent = 'Password does not meet all requirements shown below.'; return;
    }
    if (password !== confirm) {
      $('reg-error').textContent = 'Passwords do not match.'; return;
    }
    if (!validateAge(birthday)) {
      $('reg-error').textContent = 'You must be at least 13 years old to create an account.'; return;
    }

    $('reg-btn').disabled = true;
    $('reg-btn').textContent = 'Checking username…';

    if (await isUsernameTaken(username)) {
      $('reg-error').textContent = 'That username is already taken — please choose another.';
      $('reg-btn').disabled = false;
      $('reg-btn').textContent = 'Send Verification Code';
      return;
    }

    $('reg-btn').textContent = 'Sending code…';
    try {
      await startVerification({ email, username, password });
    } catch {
      $('reg-error').textContent = 'Failed to send verification email — check your connection.';
      $('reg-btn').disabled = false;
      $('reg-btn').textContent = 'Send Verification Code';
    }
  });

  // ---- Verification: 6-box auto-advance, backspace, paste ----
  const codeBoxes = Array.from(document.querySelectorAll('.code-input'));
  codeBoxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '').slice(-1);
      box.classList.toggle('filled', !!box.value);
      if (box.value && i < codeBoxes.length - 1) codeBoxes[i + 1].focus();
    });
    box.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        codeBoxes[i - 1].value = '';
        codeBoxes[i - 1].classList.remove('filled');
        codeBoxes[i - 1].focus();
      }
      if (e.key === 'Enter') $('verify-btn').click();
    });
    box.addEventListener('paste', e => {
      e.preventDefault();
      const digits = (e.clipboardData || window.clipboardData)
        .getData('text').replace(/\D/g, '').slice(0, 6);
      digits.split('').forEach((ch, j) => {
        if (codeBoxes[j]) { codeBoxes[j].value = ch; codeBoxes[j].classList.add('filled'); }
      });
      (codeBoxes.find(b => !b.value) || codeBoxes[5]).focus();
    });
  });

  // ---- Verification: submit ----
  $('verify-btn').addEventListener('click', async () => {
    $('verify-error').textContent = '';
    const code = getEnteredCode();
    if (code.length < 6) {
      $('verify-error').textContent = 'Please enter the complete 6-digit code.'; return;
    }
    if (!verif || Date.now() > verif.expiresAt) {
      $('verify-error').textContent = 'Code has expired — please request a new one.'; return;
    }
    if (code !== verif.code) {
      $('verify-error').textContent = 'Incorrect code — please try again.'; return;
    }

    $('verify-btn').disabled = true;
    $('verify-btn').textContent = 'Creating account…';
    try {
      const { user } = await fbAuth.createUserWithEmailAndPassword(pendingReg.email, pendingReg.password);
      await user.updateProfile({ displayName: pendingReg.username });
      await reserveUsername(pendingReg.username, user.uid);
      clearVerifState();
      // onAuthStateChanged fires here and hides the overlay automatically
    } catch (err) {
      $('verify-error').textContent = friendlyAuthError(err.code);
      $('verify-btn').disabled = false;
      $('verify-btn').textContent = 'Create Account';
    }
  });

  // ---- Verification: resend ----
  $('resend-code').addEventListener('click', async e => {
    e.preventDefault();
    const link = $('resend-code');
    link.style.pointerEvents = 'none';
    link.textContent = 'Sending…';
    $('verify-error').textContent = '';
    try {
      await sendCode();
      clearCodeInputs();
      startCountdown();
      if (EMAILJS_CONFIG.publicKey && !EMAILJS_CONFIG.publicKey.startsWith('YOUR_')) {
        $('verify-hint').textContent = `New code sent to ${pendingReg.email}.`;
      }
    } catch {
      $('verify-error').textContent = 'Failed to resend — check your connection.';
    } finally {
      link.style.pointerEvents = '';
      link.textContent = 'Resend code';
    }
  });

  // ---- Verification: back to registration ----
  $('go-reg-from-verify').addEventListener('click', e => {
    e.preventDefault();
    clearVerifState();
    $('reg-btn').disabled = false;
    $('reg-btn').textContent = 'Send Verification Code';
    showAuthView('register');
  });

  // ---- Reset password ----
  $('rst-btn').addEventListener('click', () => {
    const email = $('rst-email').value.trim();
    $('rst-error').textContent   = '';
    $('rst-success').textContent = '';
    if (!email) { $('rst-error').textContent = 'Please enter your email.'; return; }
    $('rst-btn').disabled = true;
    $('rst-btn').textContent = '…';
    fbAuth.sendPasswordResetEmail(email)
      .then(() => {
        $('rst-success').textContent = 'Reset email sent — check your inbox.';
        $('rst-btn').textContent = 'Sent ✓';
      })
      .catch(err => {
        $('rst-error').textContent = friendlyAuthError(err.code);
        $('rst-btn').disabled = false;
        $('rst-btn').textContent = 'Send Reset Email';
      });
  });
  $('rst-email').addEventListener('keydown', e => { if (e.key === 'Enter') $('rst-btn').click(); });

  // ---- Sign out (in profile dropdown) ----
  $('sign-out-btn').addEventListener('click', () => fbAuth.signOut());
}

/* ================================================================
   PROFILE DROPDOWN
   ================================================================ */
function initProfileDropdown() {
  const btn      = $('profile-btn');
  const dropdown = $('profile-dropdown');
  if (!btn || !dropdown) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = dropdown.hidden;
    dropdown.hidden = !isHidden;
    btn.setAttribute('aria-expanded', String(isHidden));
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.hidden && !btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dropdown.hidden) {
      dropdown.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ================================================================
   SAVE LAYOUT TO BINDER
   ================================================================ */
let selectedThumbnailUrl = null;

async function openSaveLayoutModal() {
  if (!currentUser) {
    pendingSave = true;
    openAuthModal();
    return;
  }
  if (!fbDb) return;
  selectedThumbnailUrl = null;
  $('save-layout-error').textContent = '';

  // Show overwrite option when a layout was loaded from the binder page
  if (loadedLayoutRef) {
    $('overwrite-layout-name').textContent = loadedLayoutRef.layoutName;
    $('overwrite-section').style.display = '';
  } else {
    $('overwrite-section').style.display = 'none';
  }

  // Load binders for the select
  const select = $('save-binder-select');
  select.innerHTML = '<option value="">Loading…</option>';
  try {
    const snap = await fbDb.collection('users').doc(currentUser.uid)
      .collection('binders').orderBy('createdAt').get();
    select.innerHTML = '';
    snap.docs.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.data().name;
      select.appendChild(opt);
    });
    // "+ New Binder" option
    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ Create new binder';
    select.appendChild(newOpt);

    // If no binders exist, default to creating one
    if (snap.empty) {
      select.value = '__new__';
      $('new-binder-row').style.display = '';
      $('new-binder-name').value = 'My Binder';
    }
  } catch {
    select.innerHTML = '<option value="__new__">+ Create new binder</option>';
    $('new-binder-row').style.display = '';
  }

  // Auto layout name
  try {
    const binderId = select.value === '__new__' ? null : select.value;
    await refreshLayoutName(binderId);
  } catch {}

  // Render thumbnail picker
  renderThumbnailPicker();

  showModal($('save-layout-modal'));
}

async function refreshLayoutName(binderId) {
  if (!binderId || !currentUser || !fbDb) {
    $('save-layout-name').value = 'Layout 1';
    return;
  }
  try {
    const snap = await fbDb.collection('users').doc(currentUser.uid)
      .collection('binders').doc(binderId)
      .collection('layouts').get();
    $('save-layout-name').value = `Layout ${snap.size + 1}`;
  } catch {
    $('save-layout-name').value = 'Layout 1';
  }
}

function renderThumbnailPicker() {
  const grid = $('thumbnail-card-grid');
  grid.innerHTML = '';
  const cards = Object.values(state.cards);
  if (cards.length === 0) {
    grid.innerHTML = '<p class="hint-text" style="padding:10px 0;font-size:0.76rem">No cards in the current layout.</p>';
    return;
  }
  // "Skip" tile
  const skipTile = document.createElement('div');
  skipTile.className = 'thumb-tile thumb-skip selected';
  skipTile.dataset.url = '';
  skipTile.title = 'Use auto grid preview';
  skipTile.innerHTML = `<span style="font-size:0.65rem;color:var(--text-muted);text-align:center">Auto<br>Grid</span>`;
  skipTile.addEventListener('click', () => selectThumb(skipTile, null));
  grid.appendChild(skipTile);

  cards.forEach(card => {
    if (!card.imageUrl) return;
    const tile = document.createElement('div');
    tile.className = 'thumb-tile';
    tile.dataset.url = card.imageUrl;
    tile.title = card.name || '';
    const img = document.createElement('img');
    img.src = card.imageUrl;
    img.alt = card.name || '';
    tile.appendChild(img);
    tile.addEventListener('click', () => selectThumb(tile, card.imageUrl));
    grid.appendChild(tile);
  });
}

function selectThumb(tile, url) {
  document.querySelectorAll('.thumb-tile').forEach(t => t.classList.remove('selected'));
  tile.classList.add('selected');
  selectedThumbnailUrl = url;
}

async function overwriteLayout() {
  if (!currentUser || !fbDb || !loadedLayoutRef) return;
  const btn = $('confirm-overwrite-layout');
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving…';
  $('save-layout-error').textContent = '';

  try {
    const { binderId, layoutId } = loadedLayoutRef;
    await fbDb.collection('users').doc(currentUser.uid)
      .collection('binders').doc(binderId)
      .collection('layouts').doc(layoutId)
      .update({
        layout:        state.layout,
        bgColor:       state.bgColor,
        bgTransparent: state.bgTransparent,
        cards:         state.cards,
      });
    hideModal($('save-layout-modal'));
  } catch {
    $('save-layout-error').textContent = 'Failed to save — please try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}

async function confirmSaveLayout() {
  const btn = $('confirm-save-layout');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  $('save-layout-error').textContent = '';

  const layoutName  = $('save-layout-name').value.trim() || 'Layout 1';
  const select      = $('save-binder-select');
  let   binderId    = select.value;
  const binderName  = $('new-binder-name').value.trim() || 'My Binder';

  try {
    const userRef = fbDb.collection('users').doc(currentUser.uid);

    // Create new binder if needed
    if (binderId === '__new__') {
      const newBinder = await userRef.collection('binders').add({
        name: binderName, createdAt: new Date().toISOString(),
      });
      binderId = newBinder.id;
    }

    // Save layout
    const newDoc = await userRef.collection('binders').doc(binderId).collection('layouts').add({
      name:          layoutName,
      layout:        state.layout,
      bgColor:       state.bgColor,
      bgTransparent: state.bgTransparent,
      cards:         state.cards,
      thumbnailUrl:  selectedThumbnailUrl || null,
      createdAt:     new Date().toISOString(),
    });

    // Track the new layout so future saves can overwrite it
    loadedLayoutRef = { binderId, layoutId: newDoc.id, layoutName };

    hideModal($('save-layout-modal'));
  } catch (err) {
    $('save-layout-error').textContent = 'Failed to save — please try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save to Binder';
  }
}

/* ----------------------------------------------------------------
   Build the 9 card slots for a page
   ---------------------------------------------------------------- */
/* ----------------------------------------------------------------
   Touch drag — long-press to drag cards on mobile
   ---------------------------------------------------------------- */
function startTouchDrag(slotId, initTouch) {
  touchDragSrc = slotId;
  const srcEl = document.querySelector(`[data-slot-id="${slotId}"]`);
  const img   = srcEl?.querySelector('img');

  touchGhost = document.createElement('div');
  touchGhost.className = 'touch-drag-ghost';
  if (img) {
    const clone = document.createElement('img');
    clone.src = img.src;
    touchGhost.appendChild(clone);
  }
  document.body.appendChild(touchGhost);
  moveTouchGhost(initTouch);
  srcEl?.classList.add('drag-source');
  if (navigator.vibrate) navigator.vibrate(40);

  document.addEventListener('touchmove',   onTouchDragMove, { passive: false });
  document.addEventListener('touchend',    onTouchDragEnd,  { passive: true  });
  document.addEventListener('touchcancel', onTouchDragEnd,  { passive: true  });
}

function moveTouchGhost(touch) {
  if (!touchGhost) return;
  const style = getComputedStyle(document.documentElement);
  const w = touchGhost.offsetWidth  || parseFloat(style.getPropertyValue('--card-w'))  || 97;
  const h = touchGhost.offsetHeight || parseFloat(style.getPropertyValue('--card-h')) || 136;
  touchGhost.style.left = (touch.clientX - w / 2) + 'px';
  touchGhost.style.top  = (touch.clientY - h * 0.65) + 'px';
}

function onTouchDragMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  moveTouchGhost(touch);

  touchGhost.style.visibility = 'hidden';
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  touchGhost.style.visibility = '';

  document.querySelectorAll('.drag-over').forEach(s => s.classList.remove('drag-over'));
  const targetEl = el?.closest?.('.card-slot');
  if (targetEl && targetEl.dataset.slotId !== touchDragSrc) {
    targetEl.classList.add('drag-over');
    touchDstSlot = targetEl.dataset.slotId;
  } else {
    touchDstSlot = null;
  }
}

function onTouchDragEnd() {
  document.removeEventListener('touchmove',   onTouchDragMove);
  document.removeEventListener('touchend',    onTouchDragEnd);
  document.removeEventListener('touchcancel', onTouchDragEnd);

  if (touchGhost) { touchGhost.remove(); touchGhost = null; }
  document.querySelectorAll('.drag-source').forEach(s => s.classList.remove('drag-source'));
  document.querySelectorAll('.drag-over').forEach(s => s.classList.remove('drag-over'));

  if (touchDragSrc && touchDstSlot && touchDstSlot !== touchDragSrc) {
    const src = touchDragSrc, dst = touchDstSlot;
    const srcCard = state.cards[src] || null;
    const dstCard = state.cards[dst] || null;
    if (dstCard) state.cards[src] = dstCard; else delete state.cards[src];
    if (srcCard) state.cards[dst] = srcCard; else delete state.cards[dst];
    saveState();
    renderBinder();
  }

  touchDragSrc = touchDstSlot = null;
}

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

    // ---- Touch drag: long-press to drag (mobile) ----
    if ('ontouchstart' in window) {
      let lpTimer = null, lpStartX = 0, lpStartY = 0;

      slot.addEventListener('touchstart', (e) => {
        if (!state.cards[slotId]) return;
        const t = e.touches[0];
        lpStartX = t.clientX; lpStartY = t.clientY;
        lpTimer = setTimeout(() => { lpTimer = null; startTouchDrag(slotId, t); }, 400);
      }, { passive: true });

      slot.addEventListener('touchmove', (e) => {
        if (!lpTimer) return;
        const t = e.touches[0];
        if (Math.abs(t.clientX - lpStartX) > 8 || Math.abs(t.clientY - lpStartY) > 8) {
          clearTimeout(lpTimer); lpTimer = null;
        }
      }, { passive: true });

      slot.addEventListener('touchend',   () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } }, { passive: true });
      slot.addEventListener('touchcancel',() => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } }, { passive: true });
    }

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

      // Clean up drag visuals immediately — don't wait for dragend, which can
      // silently skip when renderBinder() mutates the source slot mid-drag.
      document.querySelectorAll('.drag-source').forEach(el => el.classList.remove('drag-source'));

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
  const binder    = document.getElementById('binder');
  const colorWrap = bgColorInput.closest('.color-wrap');
  const tBtn      = $('bg-transparent');

  if (state.bgTransparent) {
    binder.classList.add('binder-transparent');
  } else {
    binder.classList.remove('binder-transparent');
    document.documentElement.style.setProperty('--binder-bg', state.bgColor);
  }

  bgColorInput.value    = state.bgColor;
  bgColorInput.disabled = state.bgTransparent;
  if (colorWrap) colorWrap.classList.toggle('dimmed', state.bgTransparent);
  if (tBtn)      tBtn.classList.toggle('active', state.bgTransparent);
}

function toggleBgTransparent() {
  state.bgTransparent = !state.bgTransparent;
  applyBgColor();
  saveState();
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
function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

async function downloadLayout(format) {
  const btn = format === 'png' ? $('dl-png') : $('dl-jpg');
  const origHTML = btn.innerHTML;
  btn.textContent = '…';
  btn.disabled = true;

  try {
    const binder = document.getElementById('binder');
    const { left: bx, top: by, width: bw, height: bh } = binder.getBoundingClientRect();
    const scale = 2;

    const offscreen = document.createElement('canvas');
    offscreen.width  = Math.round(bw * scale);
    offscreen.height = Math.round(bh * scale);
    const ctx = offscreen.getContext('2d');
    ctx.scale(scale, scale);

    // Binder background — skip for transparent PNG (canvas is clear by default);
    // always fill for JPG since JPEG has no alpha channel
    if (!state.bgTransparent || format === 'jpg') {
      ctx.fillStyle = state.bgColor || '#3a3a3a';
      ctx.fillRect(0, 0, bw, bh);
    }

    // Load card images fresh with CORS. The ?_cors suffix busts the browser
    // cache so we get a proper CORS response instead of the opaque cached
    // entry from the initial non-crossOrigin <img> load.
    const slotEls = Array.from(binder.querySelectorAll('.card-slot'));
    const imgBySlot = new Map();

    await Promise.all(slotEls.map(async slot => {
      const imgEl = slot.querySelector('img[src]');
      if (!imgEl) return;
      const img = await new Promise(resolve => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload  = () => resolve(el);
        el.onerror = () => resolve(null);
        el.src = imgEl.src + (imgEl.src.includes('?') ? '&' : '?') + '_cors';
      });
      if (img) imgBySlot.set(slot.dataset.slotId, img);
    }));

    // Draw each visible slot
    for (const slot of slotEls) {
      const sr = slot.getBoundingClientRect();
      if (!sr.width) continue;  // hidden in single-page mode

      const x = sr.left - bx;
      const y = sr.top  - by;
      const w = sr.width;
      const h = sr.height;
      const r = 7;

      // Pocket background + border
      drawRoundedRect(ctx, x, y, w, h, r);
      ctx.fillStyle   = 'rgba(0,0,0,0.32)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Card image, clipped to the slot's rounded rect
      const img = imgBySlot.get(slot.dataset.slotId);
      if (img) {
        ctx.save();
        drawRoundedRect(ctx, x, y, w, h, r);
        ctx.clip();
        ctx.drawImage(img, x, y, w, h);
        ctx.restore();
      }
    }

    const link = document.createElement('a');
    link.download = `TCGBinder.${format}`;
    link.href = offscreen.toDataURL(
      format === 'jpg' ? 'image/jpeg' : 'image/png',
      format === 'jpg' ? 0.92 : 1.0
    );
    link.click();

  } catch (err) {
    console.error('Download failed:', err);
    alert('Download failed — ' + err.message);
  } finally {
    btn.innerHTML = origHTML;
    btn.disabled  = false;
  }
}

/* ================================================================
   SAVE TO GALLERY  (mobile only — uses Web Share API on iOS)
   ================================================================ */
async function saveToGallery() {
  const btn = $('dl-gallery');
  const origHTML = btn.innerHTML;
  btn.textContent = '…';
  btn.disabled = true;

  try {
    const binder = document.getElementById('binder');
    const { left: bx, top: by, width: bw, height: bh } = binder.getBoundingClientRect();
    const scale = 2;

    const offscreen = document.createElement('canvas');
    offscreen.width  = Math.round(bw * scale);
    offscreen.height = Math.round(bh * scale);
    const ctx = offscreen.getContext('2d');
    ctx.scale(scale, scale);

    ctx.fillStyle = state.bgColor || '#3a3a3a';
    ctx.fillRect(0, 0, bw, bh);

    const slotEls = Array.from(binder.querySelectorAll('.card-slot'));
    const imgBySlot = new Map();

    await Promise.all(slotEls.map(async slot => {
      const imgEl = slot.querySelector('img[src]');
      if (!imgEl) return;
      const img = await new Promise(resolve => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload  = () => resolve(el);
        el.onerror = () => resolve(null);
        el.src = imgEl.src + (imgEl.src.includes('?') ? '&' : '?') + '_cors';
      });
      if (img) imgBySlot.set(slot.dataset.slotId, img);
    }));

    for (const slot of slotEls) {
      const sr = slot.getBoundingClientRect();
      if (!sr.width) continue;

      const x = sr.left - bx;
      const y = sr.top  - by;
      const w = sr.width;
      const h = sr.height;
      const r = 7;

      drawRoundedRect(ctx, x, y, w, h, r);
      ctx.fillStyle   = 'rgba(0,0,0,0.32)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      const img = imgBySlot.get(slot.dataset.slotId);
      if (img) {
        ctx.save();
        drawRoundedRect(ctx, x, y, w, h, r);
        ctx.clip();
        ctx.drawImage(img, x, y, w, h);
        ctx.restore();
      }
    }

    const blob = await new Promise(resolve => offscreen.toBlob(resolve, 'image/jpeg', 0.92));
    const file = new File([blob], 'TCGBinder.jpg', { type: 'image/jpeg' });

    // Web Share API: on iOS Safari this opens the native share sheet → Save Image → Camera Roll
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'TCGBinder Layout' });
    } else {
      // Fallback for browsers without file sharing (Android Chrome, etc.)
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'TCGBinder.jpg';
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Save to gallery failed:', err);
      alert('Could not save — ' + err.message);
    }
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
      layout:        state.layout,
      bgColor:       state.bgColor,
      bgTransparent: state.bgTransparent,
      cards:         state.cards,
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
    if (saved.layout)                     state.layout        = saved.layout;
    if (saved.bgColor)                    state.bgColor       = saved.bgColor;
    if (saved.bgTransparent !== undefined) state.bgTransparent = saved.bgTransparent;
    if (saved.cards)                      state.cards         = saved.cards;
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

  // Transparent background toggle
  $('bg-transparent').addEventListener('click', toggleBgTransparent);

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
  $('dl-gallery').addEventListener('click', saveToGallery);

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

  // Header toggle
  const headerToggle = $('header-toggle');
  if (headerToggle) {
    headerToggle.addEventListener('click', () => {
      document.body.classList.toggle('controls-hidden');
    });
  }

  // Sign in button (shown when signed out)
  $('signin-btn').addEventListener('click', openAuthModal);

  // Auth modal close button + backdrop click
  $('close-auth').addEventListener('click', closeAuthModal);
  $('auth-overlay').addEventListener('click', (e) => {
    if (e.target === $('auth-overlay')) closeAuthModal();
  });

  // Profile dropdown
  initProfileDropdown();

  // Save to Binder
  $('save-binder-btn').addEventListener('click', openSaveLayoutModal);
  $('close-save-layout').addEventListener('click', () => hideModal($('save-layout-modal')));
  $('save-layout-modal').addEventListener('click', (e) => {
    if (e.target === $('save-layout-modal')) hideModal($('save-layout-modal'));
  });
  $('save-binder-select').addEventListener('change', async () => {
    const val = $('save-binder-select').value;
    $('new-binder-row').style.display = val === '__new__' ? '' : 'none';
    if (val !== '__new__') await refreshLayoutName(val);
  });
  $('confirm-overwrite-layout').addEventListener('click', overwriteLayout);
  $('confirm-save-layout').addEventListener('click', confirmSaveLayout);

  // Load layout confirm modal
  $('load-layout-modal').addEventListener('click', (e) => {
    if (e.target === $('load-layout-modal')) hideModal($('load-layout-modal'));
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

/* ================================================================
   BOOTSTRAP  (script is at end of <body>, DOM is ready)
   ================================================================ */
buildSlots(leftPage, 'left');
buildSlots(rightPage, 'right');
addSpineRings();
attachEvents();

/* ---- Beta gate ---- */
(function () {
  const BETA_KEY  = 'tcgbinder_beta_ok';
  const BETA_PASS = 'wilson87564';
  const gate      = $('beta-gate');

  function isSaved() {
    try { if (localStorage.getItem(BETA_KEY) === '1') return true; } catch {}
    return document.cookie.split(';').some(c => c.trim().startsWith(BETA_KEY + '=1'));
  }

  function save() {
    try { localStorage.setItem(BETA_KEY, '1'); } catch {}
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 1);
    document.cookie = BETA_KEY + '=1; expires=' + exp.toUTCString() + '; path=/; SameSite=Lax';
  }

  function unlock() {
    gate.style.display = 'none';
    document.body.classList.remove('beta-locked');
  }

  if (isSaved()) { unlock(); return; }
  document.body.classList.add('beta-locked');

  $('beta-btn').addEventListener('click', () => {
    if ($('beta-password').value === BETA_PASS) {
      save();
      unlock();
    } else {
      $('beta-error').textContent = 'Incorrect password — try again.';
      $('beta-password').value = '';
      $('beta-password').focus();
    }
  });
  $('beta-password').addEventListener('keydown', e => { if (e.key === 'Enter') $('beta-btn').click(); });
})();

if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.startsWith('YOUR_')) {
  // Firebase not yet configured — run without auth for local development
  loadState();
  renderBinder();
  applyBgColor();
} else {
  firebase.initializeApp(FIREBASE_CONFIG);
  const fbAuth = firebase.auth();
  fbDb = firebase.firestore();
  attachAuthEvents(fbAuth);
  fbAuth.onAuthStateChanged(handleAuthState);
}
