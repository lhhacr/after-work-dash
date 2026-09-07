# After-Work Dash

Endless runner about the commute home: tap to jump and dodge street hazards. Pure static front-end — deploy straight to Vercel.

## Local preview

```bash
npx --yes serve .
```

Or open `index.html` in a browser.

## Controls

- Click canvas / Space / ↑ to jump
- Hit an obstacle to end the run; score and best are stored in `localStorage`

## Deploy on Vercel

1. Push this repo to GitHub  
2. [Vercel](https://vercel.com) → **Add New Project** → import the repo  
3. Framework Preset: **Other**; leave Build Command empty; output is the repo root  
4. Deploy → play at `*.vercel.app`

No ICP filing or Node build required.

## Layout

```
index.html
css/style.css
js/game.js
assets/sprites/   # Kenney CC0 sprites (see ATTRIBUTION.md)
```

## Later ideas

- Duck under low hazards
- SFX / skins (rainy day, Friday)
- Google AdSense once you have traffic
