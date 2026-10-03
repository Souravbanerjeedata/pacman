# Neon Pac-Man

![preview]("./preview.png")

A modern, neon-styled Pac-Man game built with pure HTML, CSS, and vanilla JavaScript (HTML5 Canvas).

**No external image assets required** — everything is drawn on canvas.

---

## Play

Open `index.html` in any modern browser, or host the folder on GitHub Pages.

---

## Features

- **Neon visual design** — glowing walls, pulsing power pellets, neon Pac-Man & ghosts
- **Power pellets** — eat ghosts for bonus points (chain multiplier)
- **Tunnel wrap** — exit left/right and appear on the other side
- **Smart-ish ghost AI** — chase when normal, flee when scared, return home when eaten
- **Lives system** (3) + level progression
- **Score** — pellets, power pellets, eaten ghosts, level clear bonus
- **Mouth animation** & scared-ghost blinking near end of power mode
- **Mobile-friendly** — swipe to move
- Fully responsive (tile size scales to screen)

---

## Controls

### Desktop

| Key     | Action          |
| ------- | --------------- |
| ← → ↑ ↓ | Move            |
| W A S D | Move            |
| Space   | Start / Restart |

### Mobile

1. Tap **START**
2. **Swipe** in any direction to move Pac-Man

---

## Scoring

| Action            | Points            |
| ----------------- | ----------------- |
| Pellet            | 10                |
| Power pellet      | 50                |
| 1st ghost eaten   | 200               |
| 2nd ghost (chain) | 400               |
| 3rd               | 800               |
| 4th               | 1600              |
| Level clear       | 500 × (level − 1) |

Ghosts get faster and power mode gets shorter as levels increase.

---

## Project Structure

```
pacman/
├── index.html   # Markup + modals
├── style.css    # Neon theme, responsive layout
├── app.js       # Full game logic (canvas drawing + AI)
└── README.md
```

No build step. No dependencies. No image files.

---

## Author

**Sourav Banerjee**

GitHub: [Souravbanerjeedata](https://github.com/Souravbanerjeedata)
