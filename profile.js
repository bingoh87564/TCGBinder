/* ================================================================
   profile.js — Account Settings page
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

let currentUser = null;
let userData    = null;  // Firestore user doc

/* ================================================================
   AUTH
   ================================================================ */
fbAuth.onAuthStateChanged(async user => {
  if (!user) { window.location.href = 'index.html'; return; }
  currentUser = user;
  const snap = await fbDb.collection('users').doc(user.uid).get().catch(() => null);
  userData = snap?.exists ? snap.data() : {};
  initPage();
});

/* ================================================================
   INIT
   ================================================================ */
function initPage() {
  $('page-loading').style.display  = 'none';
  $('settings-content').style.display = '';

  // Header profile area
  $('profile-area').style.display = 'flex';
  initHeaderDropdown();

  // Large avatar
  updateAvatarDisplay();

  // Info
  $('display-username').textContent = userData?.username || currentUser.displayName || '—';
  $('display-email').textContent    = currentUser.email  || '—';

  // Events
  $('avatar-large').addEventListener('click', () => $('photo-input').click());
  $('photo-input').addEventListener('change', onPhotoSelected);

  $('new-password').addEventListener('input', () => updatePwdReqs($('new-password').value));

  $('save-username-btn').addEventListener('click', changeUsername);
  $('save-password-btn').addEventListener('click', changePassword);
  $('delete-account-btn').addEventListener('click', () => {
    $('delete-confirm-password').value = '';
    $('delete-account-error').textContent = '';
    showModal('delete-account-modal');
  });

  $('cancel-delete-account').addEventListener('click', () => hideModal('delete-account-modal'));
  $('confirm-delete-account').addEventListener('click', deleteAccount);

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });
}

/* ================================================================
   HEADER DROPDOWN
   ================================================================ */
function initHeaderDropdown() {
  updateHeaderAvatar();
  $('profile-btn').addEventListener('click', e => {
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

function updateHeaderAvatar() {
  const av = $('profile-avatar');
  if (userData?.photoData) {
    av.style.backgroundImage = `url(${userData.photoData})`;
    av.textContent = '';
    av.classList.add('has-photo');
  } else {
    av.style.backgroundImage = '';
    const name = userData?.username || currentUser?.displayName || currentUser?.email || '?';
    av.textContent = name[0].toUpperCase();
    av.classList.remove('has-photo');
  }
}

function updateAvatarDisplay() {
  const av     = $('avatar-large');
  const letter = $('avatar-letter');
  if (userData?.photoData) {
    av.style.backgroundImage = `url(${userData.photoData})`;
    letter.textContent = '';
    av.classList.add('has-photo');
  } else {
    av.style.backgroundImage = '';
    const name = userData?.username || currentUser?.displayName || currentUser?.email || '?';
    letter.textContent = name[0].toUpperCase();
    av.classList.remove('has-photo');
  }
}

/* ================================================================
   MODAL HELPERS
   ================================================================ */
function showModal(id) { $(id).classList.remove('hidden'); }
function hideModal(id) { $(id).classList.add('hidden');    }
function closeAllModals() {
  ['crop-modal','delete-account-modal'].forEach(hideModal);
}

/* ================================================================
   PROFILE PICTURE — upload + crop
   ================================================================ */
const CROP_SIZE = 280;
const CROP_R    = 126;

let cropState = { img: null, scale: 1, ox: 0, oy: 0, dragging: false, lastX: 0, lastY: 0 };

function onPhotoSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  $('photo-input').value = '';
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      cropState.img = img;
      // Initial scale: cover the crop circle
      const minDim = Math.min(img.width, img.height);
      cropState.scale = (CROP_R * 2) / minDim;
      cropState.ox = (CROP_SIZE - img.width  * cropState.scale) / 2;
      cropState.oy = (CROP_SIZE - img.height * cropState.scale) / 2;
      $('crop-zoom').value = cropState.scale;
      $('crop-zoom').min   = cropState.scale;
      $('crop-zoom').max   = cropState.scale * 4;
      showModal('crop-modal');
      renderCrop();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function renderCrop() {
  const canvas = $('crop-canvas');
  const ctx    = canvas.getContext('2d');
  const W = CROP_SIZE, H = CROP_SIZE, R = CROP_R;
  ctx.clearRect(0, 0, W, H);

  if (!cropState.img) return;

  // Draw image
  const iw = cropState.img.width  * cropState.scale;
  const ih = cropState.img.height * cropState.scale;
  ctx.drawImage(cropState.img, cropState.ox, cropState.oy, iw, ih);

  // Dark vignette outside circle (evenodd hole)
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.68)';
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  ctx.restore();

  // Circle border
  ctx.strokeStyle = 'rgba(108,99,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2);
  ctx.stroke();
}

function clampCrop() {
  const iw = cropState.img.width  * cropState.scale;
  const ih = cropState.img.height * cropState.scale;
  const cx = CROP_SIZE / 2, cy = CROP_SIZE / 2;
  // Keep circle area (cx±R, cy±R) inside the image
  cropState.ox = Math.min(cx - CROP_R, Math.max(cx + CROP_R - iw, cropState.ox));
  cropState.oy = Math.min(cy - CROP_R, Math.max(cy + CROP_R - ih, cropState.oy));
}

// Zoom
$('crop-zoom').addEventListener('input', () => {
  const newScale = parseFloat($('crop-zoom').value);
  const cx = CROP_SIZE / 2, cy = CROP_SIZE / 2;
  // Scale around center of crop circle
  cropState.ox = cx - (cx - cropState.ox) * (newScale / cropState.scale);
  cropState.oy = cy - (cy - cropState.oy) * (newScale / cropState.scale);
  cropState.scale = newScale;
  clampCrop();
  renderCrop();
});

// Mouse drag
const cropCanvas = $('crop-canvas');
cropCanvas.addEventListener('mousedown', e => {
  cropState.dragging = true;
  cropState.lastX    = e.clientX;
  cropState.lastY    = e.clientY;
});
window.addEventListener('mousemove', e => {
  if (!cropState.dragging) return;
  cropState.ox += e.clientX - cropState.lastX;
  cropState.oy += e.clientY - cropState.lastY;
  cropState.lastX = e.clientX;
  cropState.lastY = e.clientY;
  clampCrop();
  renderCrop();
});
window.addEventListener('mouseup', () => { cropState.dragging = false; });

// Touch drag
cropCanvas.addEventListener('touchstart', e => {
  e.preventDefault();
  cropState.dragging = true;
  cropState.lastX = e.touches[0].clientX;
  cropState.lastY = e.touches[0].clientY;
}, { passive: false });
cropCanvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!cropState.dragging) return;
  cropState.ox += e.touches[0].clientX - cropState.lastX;
  cropState.oy += e.touches[0].clientY - cropState.lastY;
  cropState.lastX = e.touches[0].clientX;
  cropState.lastY = e.touches[0].clientY;
  clampCrop();
  renderCrop();
}, { passive: false });
cropCanvas.addEventListener('touchend', () => { cropState.dragging = false; });

// Cancel crop
$('close-crop').addEventListener('click', () => hideModal('crop-modal'));
$('cancel-crop').addEventListener('click', () => hideModal('crop-modal'));

// Confirm crop — extract circle, compress, save to Firestore
$('confirm-crop').addEventListener('click', async () => {
  const btn = $('confirm-crop');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    const photoData = extractCropCircle();
    await fbDb.collection('users').doc(currentUser.uid)
      .set({ photoData }, { merge: true });
    userData = { ...userData, photoData };
    hideModal('crop-modal');
    updateAvatarDisplay();
    updateHeaderAvatar();
  } catch (err) {
    console.error('Photo save error:', err);
    alert('Failed to save photo: ' + (err.message || err.code || 'unknown error'));
  } finally {
    btn.disabled = false; btn.textContent = 'Save Photo';
  }
});

function extractCropCircle() {
  const off = document.createElement('canvas');
  off.width = off.height = CROP_R * 2;
  const ctx = off.getContext('2d');
  ctx.beginPath();
  ctx.arc(CROP_R, CROP_R, CROP_R, 0, Math.PI * 2);
  ctx.clip();
  // Draw the relevant region of the crop canvas centred on the circle
  ctx.drawImage(
    $('crop-canvas'),
    CROP_SIZE / 2 - CROP_R, CROP_SIZE / 2 - CROP_R,
    CROP_R * 2, CROP_R * 2,
    0, 0, CROP_R * 2, CROP_R * 2
  );
  return off.toDataURL('image/jpeg', 0.82);
}

/* ================================================================
   CHANGE USERNAME
   ================================================================ */
async function changeUsername() {
  const newName = $('new-username').value.trim();
  $('username-error').textContent   = '';
  $('username-success').textContent = '';

  if (!newName) { $('username-error').textContent = 'Please enter a username.'; return; }
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(newName)) {
    $('username-error').textContent = 'Username must be 3–20 characters (letters, numbers, _ or -).'; return;
  }
  if (newName.toLowerCase() === (userData?.username || '').toLowerCase()) {
    $('username-error').textContent = 'That\'s already your username.'; return;
  }

  const btn = $('save-username-btn');
  btn.disabled = true; btn.textContent = 'Checking…';

  try {
    // Check uniqueness
    const snap = await fbDb.collection('usernames').doc(newName.toLowerCase()).get();
    if (snap.exists) {
      $('username-error').textContent = 'That username is already taken.';
      return;
    }

    btn.textContent = 'Saving…';
    const batch = fbDb.batch();
    // Remove old username mapping
    if (userData?.username) {
      batch.delete(fbDb.collection('usernames').doc(userData.username.toLowerCase()));
    }
    // Add new mapping
    batch.set(fbDb.collection('usernames').doc(newName.toLowerCase()), { uid: currentUser.uid });
    // Update user doc
    batch.update(fbDb.collection('users').doc(currentUser.uid), { username: newName });
    await batch.commit();
    // Update Firebase Auth display name
    await currentUser.updateProfile({ displayName: newName });

    userData = { ...userData, username: newName };
    $('display-username').textContent = newName;
    updateAvatarDisplay();
    updateHeaderAvatar();
    $('username-success').textContent = 'Username updated successfully!';
    $('new-username').value = '';
  } catch {
    $('username-error').textContent = 'Failed to update username — please try again.';
  } finally {
    btn.disabled = false; btn.textContent = 'Save Username';
  }
}

/* ================================================================
   CHANGE PASSWORD
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

async function changePassword() {
  const oldPw  = $('current-password').value;
  const newPw  = $('new-password').value;
  const confPw = $('confirm-new-password').value;
  $('password-error').textContent   = '';
  $('password-success').textContent = '';

  if (!oldPw)         { $('password-error').textContent = 'Please enter your current password.'; return; }
  if (!allPwdReqsMet(newPw)) { $('password-error').textContent = 'New password does not meet all requirements.'; return; }
  if (newPw !== confPw)      { $('password-error').textContent = 'Passwords do not match.'; return; }

  const btn = $('save-password-btn');
  btn.disabled = true; btn.textContent = 'Verifying…';

  try {
    // Re-authenticate first
    const cred = firebase.auth.EmailAuthProvider.credential(currentUser.email, oldPw);
    await currentUser.reauthenticateWithCredential(cred);
    btn.textContent = 'Saving…';
    await currentUser.updatePassword(newPw);
    $('password-success').textContent = 'Password changed successfully!';
    $('current-password').value = '';
    $('new-password').value     = '';
    $('confirm-new-password').value = '';
    updatePwdReqs('');
  } catch (err) {
    const msg = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
      ? 'Current password is incorrect.'
      : 'Failed to change password — please try again.';
    $('password-error').textContent = msg;
  } finally {
    btn.disabled = false; btn.textContent = 'Change Password';
  }
}

/* ================================================================
   DELETE ACCOUNT
   ================================================================ */
async function deleteAccount() {
  const password = $('delete-confirm-password').value;
  $('delete-account-error').textContent = '';
  if (!password) { $('delete-account-error').textContent = 'Please enter your password.'; return; }

  const btn = $('confirm-delete-account');
  btn.disabled = true; btn.textContent = 'Deleting…';

  try {
    // Re-authenticate
    const cred = firebase.auth.EmailAuthProvider.credential(currentUser.email, password);
    await currentUser.reauthenticateWithCredential(cred);

    const uid = currentUser.uid;
    const userRef = fbDb.collection('users').doc(uid);

    // Delete all binders + layouts
    const bindersSnap = await userRef.collection('binders').get();
    for (const binderDoc of bindersSnap.docs) {
      const layoutsSnap = await binderDoc.ref.collection('layouts').get();
      const batch = fbDb.batch();
      layoutsSnap.docs.forEach(l => batch.delete(l.ref));
      batch.delete(binderDoc.ref);
      await batch.commit();
    }

    // Delete username mapping
    if (userData?.username) {
      await fbDb.collection('usernames').doc(userData.username.toLowerCase()).delete().catch(() => {});
    }

    // Delete user doc
    await userRef.delete().catch(() => {});

    // Delete Firebase Auth user
    await currentUser.delete();

    window.location.href = 'index.html';
  } catch (err) {
    const msg = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
      ? 'Incorrect password.'
      : 'Failed to delete account — please try again.';
    $('delete-account-error').textContent = msg;
    btn.disabled = false; btn.textContent = 'Delete Forever';
  }
}
