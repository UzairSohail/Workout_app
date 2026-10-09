# Workout

A free workout tracker for two, built as an installable web app (PWA). It works on iPhone and Android, keeps working offline at the gym, and has no accounts, ads or fees.

## Features

- **Splits:** built-in Full Body, Upper/Lower, Push/Pull/Legs and Bro Split, or build your own (days, exercises, sets, rep range, rest).
- **Ready-made programs:** 5×5 Linear (beginner), GZCLP and 5/3/1, each with its own progression: linear jumps with a deload after 3 misses, GZCLP T1/T2/T3 stage changes, and 5/3/1 training-max percentages over 4-week cycles. Set starting weights or training maxes on the program page. Custom splits can use any of these progressions per exercise.
- **Routine generator:** answer five questions (goal, days per week, time, experience, equipment) and get a ready-to-use split built from the exercise library.
- **Exercise library:** 927 exercises (876 from free-exercise-db plus 51 common gym moves added by this app, without photos), searchable by everyday names like "pec deck" or "RDL", with start/end photos that animate like a GIF, instructions, muscle and equipment filters, a YouTube form-video link, and custom exercises.
- **Workout logging:** target and helper muscles shown as tags on every exercise, last session's numbers inline, automatic warm-up sets before heavy lifts (can be turned off in Settings), a "+ Superset" button on every exercise, one-tap exercise swap when a machine is taken (same muscle by default, with fresh ideas on top), a nudge to try something different when you've done the same lift the last 4 times you trained that muscle, drop sets, supersets (rest only after the last exercise), timed sets with a stopwatch for planks, holds and cardio, sticky per-exercise notes like "seat on 4", plates per side for barbell lifts, an automatic rest timer with vibration and a beep, and the screen kept awake.
- **Starting weights:** add your body weight, height, sex and experience in Settings and the first session of any loaded exercise is pre-filled with a sensible starting weight.
- **Progressive overload:** double progression. Hit the top of the rep range on every set and the next session pre-fills the heavier weight. Fall short twice and it suggests a 10% deload.
- **Calories:** a live estimate in the workout header that goes up with every set you tick off (based on your body weight, the exercise type, reps or time, and rest), also shown on each finished workout.
- **PRs:** heaviest weight, best estimated 1RM (Epley) and bodyweight rep records, flagged live with 🏆.
- **Progress:** workouts per week, weekly volume, sets per muscle over the last 7 days, a week streak, and a body-weight log with a chart.
- **History:** a calendar, per-workout detail, per-exercise history and an estimated-1RM trend. Repeat any past workout.
- **Your data:** stored on your phone (IndexedDB). Export or import a JSON backup, or export a CSV.
- **My gym's equipment:** untick what your gym lacks in Settings and exercise lists, swap suggestions and the routine builder leave those exercises out.
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
