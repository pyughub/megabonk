# MEGABONK

A fan-made browser clone of the 3D survivor-like **Megabonk**: third-person movement, auto-weapons, XP tomes, and a 10-minute run that ends in a boss.

This is an original recreation of the *loop*, not a copy of official art, audio, or characters.

## Play

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Click the canvas once a run starts so the mouse can look around.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look (pointer lock) |
| Space | Jump / double jump |
| Shift | Slide (brief i-frames) |
| E | Chest, shrine, shop tent, greed cone |
| 1 / 2 / 3 | Pick a level-up card |
| Esc | Pause / leave shop |

## The loop

Survive 10 minutes while weapons fire themselves. Gems level you up. Each level offers three random weapons or tomes. At 3:00 and 6:30 a mini-boss shows up. At 10:00 the big one does. Kill it to win.

Unlock **Zipper** with 250 lifetime kills and **Brick** by surviving 5:00. Progress is stored in `localStorage`.
