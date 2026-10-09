# Workout

A free workout tracker for two, built as an installable web app (PWA). It works on iPhone and Android, keeps working offline at the gym, and has no accounts, ads or fees.

## Features

- **Splits:** built-in Full Body, Upper/Lower, Push/Pull/Legs and Bro Split, or build your own (days, exercises, sets, rep range, rest).
- **Ready-made programs:** 5×5 Linear (beginner), GZCLP and 5/3/1, each with its own progression: linear jumps with a deload after 3 misses, GZCLP T1/T2/T3 stage changes, and 5/3/1 training-max percentages over 4-week cycles. Set starting weights or training maxes on the program page. Custom splits can use any of these progressions per exercise.
- **Exercise library:** 876 exercises with start/end photos that animate like a GIF, instructions, muscle and equipment filters, a YouTube form-video link, and custom exercises.
- **Workout logging:** last session's numbers inline, warm-up and drop sets, an automatic rest timer with vibration and a beep, and the screen kept awake.
- **Progressive overload:** double progression. Hit the top of the rep range on every set and the next session pre-fills the heavier weight. Fall short twice and it suggests a 10% deload.
- **PRs:** heaviest weight, best estimated 1RM (Epley) and bodyweight rep records, flagged live with 🏆.
- **History:** a calendar, per-workout detail, per-exercise history and an estimated-1RM trend. Repeat any past workout.
- **Your data:** stored on your phone (IndexedDB). Export or import a JSON backup, or export a CSV.
- kg/lb, configurable increments and a plate calculator.

## Install on your phone

Open the hosted URL, then:
- **iPhone (Safari):** Share → Add to Home Screen.
- **Android (Chrome):** ⋮ → Install app.

Use the app from the home-screen icon. On iPhone that also stops Safari clearing its storage.

## Develop

```sh
npm install
npm run dev      # local dev server
npm test         # unit tests (progression, PRs, plates, units)
npm run build    # static site in dist/
```

## Free hosting

The build is a static folder (`dist/`) with relative paths, so any static host works.

- **GitHub Pages** (set up): make the repo public, then go to Settings → Pages → Source: **GitHub Actions**. `.github/workflows/deploy.yml` deploys every push to `master` to `https://<owner>.github.io/Workout_app/`. While the repo is private, the deploy job is skipped.
- **Cloudflare Pages**, **Netlify** or **Vercel** (works with a private repo): connect the repo with build command `npm run build` and output `dist`.

## Credits

Exercise data and images: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain), pinned to a commit and served via jsDelivr. Regenerate the data with `npm run data`.
