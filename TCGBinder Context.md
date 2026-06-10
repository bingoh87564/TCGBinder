# TCGBinder — Session Context

_Last updated: 2026-06-09_

---

## Project Overview

**TCGBinder** is a hosted Pokémon TCG binder layout tool. Users can build visual card binders, search for cards via the pokemontcg.io API, drag/arrange cards, save layouts into named binders (folders), and manage their account.

- **Live URL:** `https://tcgbinder-f3a18.web.app` (Firebase Hosting)
- **Project folder:** `C:\TCGBinder\`
- **Firebase project ID:** `tcgbinder-f3a18`
- **Deploy command:** `cd C:\TCGBinder` then `firebase deploy`

---

## File Structure

```
C:\TCGBinder\
  index.html        — Main layout tool (binder + card search)
  app.js            — All JS for index.html
  style.css         — Shared styles across all pages
  binder.html       — My Binder gallery page (view/load/delete layouts)
  binder.js         — JS for binder.html
  profile.html      — Account Settings page
  profile.js        — JS for profile.html
  firebase.json     — Firebase Hosting config (public: ".")
  .firebaserc       — Firebase project binding (tcgbinder-f3a18)
  TCGBinder Context.md — This file
```

---

## Third-Party Services

### Firebase (tcgbinder-f3a18)
- **Auth:** Email/Password + Google sign-in enabled
- **Firestore:** Stores user data, usernames, binders, layouts
- **Hosting:** Live at `https://tcgbinder-f3a18.web.app`
- Config lives at top of `app.js`, `binder.js`, `profile.js` (repeated in each)

### EmailJS
- Used for sending 6-digit email verification codes during account creation
- Config in `app.js` → `EMAILJS_CONFIG { publicKey, serviceId, templateId }`
- Template variables: `{{to_email}}`, `{{to_name}}`, `{{verification_code}}`
- Dev fallback: if not configured, code logs to browser console

### pokemontcg.io v2
- `https://api.pokemontcg.io/v2` — no API key needed (1,000 req/day free)
- Card fields: `id`, `name`, `images.small/large`, `set.name`, `set.series`, `set.releaseDate`, `rarity`, `supertype`, `subtypes`

---

## Firestore Data Structure

```
/usernames/{lowercase_username}
  → { uid }                          ← for uniqueness checks

/users/{uid}
  → { username, email, createdAt, photoData (base64 JPEG or null) }

/users/{uid}/binders/{binderId}
  → { name, createdAt }

/users/{uid}/binders/{binderId}/layouts/{layoutId}
  → { name, layout ('single'|'double'), bgColor, cards, thumbnailUrl (null|url), createdAt }
```

### Firestore Security Rules (must be set in Firebase Console)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usernames/{username} {
      allow read;
      allow write: if request.auth != null;
    }
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
      match /binders/{binderId} {
        allow read, write: if request.auth.uid == uid;
        match /layouts/{layoutId} {
          allow read, write: if request.auth.uid == uid;
        }
      }
    }
  }
}
```

---

## Authentication Flow

### Sign In
- Email/password or Google popup
- Session persists automatically (Firebase onAuthStateChanged)
- `handleAuthState(user)` in app.js controls showing/hiding the app vs auth overlay

### Account Creation (multi-step)
1. Fill email, username (3–20 chars, unique), password (8+ chars, uppercase + lowercase + number + special), birthday (13+ years old)
2. Username uniqueness checked against `/usernames/` in Firestore
3. EmailJS sends 6-digit code (expires 5 min, resendable)
4. Code verified client-side → Firebase account created → username reserved in Firestore

### Session Storage
- Firebase handles session persistence natively
- Beta gate uses both `localStorage` + `document.cookie` as fallback (key: `tcgbinder_beta_ok`)

---

## Beta Gate

- Password: `wilson87564`
- Stored in both localStorage AND a 1-year cookie (handles browsers that block localStorage)
- Shows a full-screen gate before the app loads
- `body.beta-locked` CSS class hides all page content until unlocked
- Key: `tcgbinder_beta_ok`

---

## Features Implemented

### Binder Layout (index.html)
- **Single page** (3×3, 9 slots) and **Two-page spread** (2×3×3, 18 slots) — toggle in header
- Card slot dimensions: `172px × 240px` (desktop); scales down on mobile
- Background color changeable via color picker
- State persists in `localStorage` under key `poketopia_v1` (`{ layout, bgColor, cards }`)
- **Save PNG/JPG**: manual Canvas 2D renderer; loads images with `crossOrigin='anonymous'` + `?_cors` cache-buster

### Drag & Drop
- HTML5 drag API for desktop; long-press (400ms) touch drag for mobile
- Touch drag: `startTouchDrag()` / `onTouchDragMove()` / `onTouchDragEnd()` functions in app.js
- Ghost element follows finger on mobile; haptic vibration on drag start
- Fix in place: `drop` handler cleans up `.drag-source` class immediately before any DOM mutations (prevents Chromium's silent `dragend` skip bug)

### Profile Icon & Navigation
- Circular avatar in top-right of every page header
- Shows first letter of username OR uploaded profile photo
- Dropdown: **My Binder** → `binder.html` | **Account Settings** → `profile.html` | **Sign Out**
- Profile area hidden when signed out, shown when signed in

### Save to Binder
- "Save" button in the header toolbar (only visible when logged in)
- Modal flow:
  1. Choose existing binder or create new one
  2. Name the layout (defaults to "Layout N" based on count in that binder)
  3. Optionally select a card as the thumbnail (or skip for auto mini-grid)
- Saves to Firestore: `/users/{uid}/binders/{binderId}/layouts/`

### My Binder Page (binder.html)
- Lists all binders as cards (name, layout count)
- Click binder → shows its layouts
- Each layout card: thumbnail (featured card OR 3×3 mini grid), name, date, card count, page type
- Click layout → full preview modal showing the card grid
- Preview → "Load this Layout" → confirmation → stores data in `sessionStorage` key `tcgbinder_load` → redirects to `index.html` which applies it
- CRUD: create binder, rename binder, delete binder (deletes all layouts inside with warning), rename layout, delete layout

### Account Settings Page (profile.html)
- **Profile picture**: click avatar → file picker → canvas crop tool (drag + zoom slider, circular preview with evenodd overlay) → saves as base64 JPEG (~252×252px) to Firestore user doc via `set({ merge: true })`
- **Change username**: validates format + uniqueness → updates `/usernames/` + `/users/{uid}` + Firebase Auth displayName
- **Change password**: re-authenticates with old password first → `updatePassword()`
- **Delete account**: re-authenticates → batch-deletes all binders + layouts → deletes user doc + username mapping → deletes Firebase Auth user → redirects to index.html

---

## Mobile Improvements

- **Responsive card sizes** via CSS custom property overrides in media queries:
  - `≤640px`: `--card-w: 97px; --card-h: 136px; --gap: 8px; --page-pad: 14px`
  - `≤380px`: `--card-w: 85px; --card-h: 119px; --gap: 6px; --page-pad: 12px`
- **Header collapse**: toggle button (chevron) on mobile shows/hides `.header-controls` via `body.controls-hidden` class
- **Remove button**: always visible on mobile (`≤640px`), not just on hover
- **Touch drag**: long-press (400ms) any card to enter drag mode; movement >8px during wait cancels it

---

## Key Constants & IDs (app.js)

```javascript
STORAGE_KEY = 'poketopia_v1'          // localStorage key
FIREBASE_CONFIG = { ... }             // Firebase credentials
EMAILJS_CONFIG  = { publicKey, serviceId, templateId }

// Module-level state
let dragSourceSlot = null
let currentUser    = null             // signed-in Firebase user
let touchDragSrc   = null             // touch drag source slot ID
let touchGhost     = null             // floating ghost element
let touchDstSlot   = null             // touch drag target slot ID
let pendingReg     = null             // { email, username, password } during verification
let verif          = null             // { code, expiresAt }
let countdownTimer = null
let fbDb           = null             // Firestore instance
let selectedThumbnailUrl = null       // chosen thumbnail in save modal
```

---

## CSS Custom Properties

```css
--binder-bg:    #3a3a3a      /* user-changeable */
--card-w:       172px        /* overridden on mobile */
--card-h:       240px
--gap:          16px
--page-pad:     30px
--spine-w:      22px
--accent:       #6c63ff
--danger:       #e05252
--success:      #4caf76
--header-bg:    #141420
--panel-bg:     #1a1a2e
```

---

## Known Issues / Pending Fixes

- **Profile photo save error**: changed `update()` → `set({ merge: true })` to handle Google sign-in users who have no Firestore user doc. Error popup now shows exact message. Still being tested by user.
- **localStorage key is still `poketopia_v1`** — old name from before rename. Safe to leave or migrate in a future session.
- **Language filter is cosmetic** — pokemontcg.io is English-only.
- **Download CORS (local file mode)**: only affects `file://` protocol; hosted version works correctly via Canvas 2D renderer with `crossOrigin='anonymous'` + `?_cors`.

---

## Important Bugs Fixed This Session

| Bug | Root cause | Fix |
|-----|-----------|-----|
| PNG/JPG export showed empty binder | html2canvas blocked by opaque CORS cache | Replaced with manual Canvas 2D renderer |
| Drag left source slot permanently transparent | Chromium silently skips `dragend` when DOM mutated during `drop` | Clean up `.drag-source` class at start of `drop` handler |
| Beta gate reappeared on Opera GX despite clearing cookies | Opera GX blocks localStorage | Now saves to both localStorage AND `document.cookie` |
| Profile photo save error | `update()` fails on non-existent Firestore doc (Google users) | Changed to `set({ photoData }, { merge: true })` |

---

## Deployment

```bash
cd C:\TCGBinder
firebase deploy
```

Requires: Node.js installed, `firebase-tools` installed globally (`npm install -g firebase-tools`), logged in (`firebase login`).
