# Trala.la

Conversation cards for groups. Next.js (App Router), no database, no accounts.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — it's designed for a phone, so use the device toolbar
in your browser's dev tools.

## Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. vercel.com → **Add New… → Project** → import the repo.
3. Framework preset detects Next.js. No environment variables needed. Deploy.

Every push to `main` redeploys.

## Changing content — the only file you normally touch

**`lib/content.js`** holds everything: categories, all 150 questions in English and
Lithuanian, every piece of interface copy, the card surfaces and category tints.

Add a question — append a row to `Q`:

```js
['fun', 'English question?', 'Klausimas lietuviškai?', 50],
```

The fourth number is the like-rate shown on the "Most loved" screen. Until real
ratings are collected it is seed data; replace it with values from your backend.

Add a category — add to `CATS` (`id`, `en`, `lt`, `icon`, optional `note`), add a hue
to `CAT_TINT`, then write its questions. Adding it to `OPT_IN` keeps it out of the
default deck (as with Spicy and Couples).

Change interface wording — edit `UI.en` / `UI.lt`.

## Structure

```
app/layout.jsx    fonts, metadata, PWA manifest link
app/page.jsx      the whole app: home, deck, favourites, most loved, share, feedback
app/globals.css   resets and font variables — all other styling is inline
lib/content.js    ← all content
lib/deck.js       shuffle and deck-building
lib/analytics.js  anonymous device id + the four MVP metrics (stubbed)
public/manifest.json  PWA
```

## Card surface

`SURFACE` at the top of `app/page.jsx`: `'Warm paper'` (default), `'Ash grey'`,
`'Category tint'`, or `'Ink card'`.

## Still to wire up

- **Ratings backend.** `lib/analytics.js` has the anonymous device id and a `track()`
  stub. Point it at a route that writes to Vercel Postgres or Supabase, then read real
  percentages into the "Most loved" screen instead of the seeded fourth column.
- **Share as an image.** The share screen currently uses the Web Share API with text.
  For the card as a picture, render the same layout through `@vercel/og`.
- **PWA icons.** `public/icon-192.png` and `icon-512.png` are referenced by the
  manifest and need to be added.
- **Lithuanian proofing.** The translations are a first pass — have a native speaker
  review, especially Spicy and Couples.
