(() => {
  "use strict";

  // ─── Constants ───────────────────────────────────────────────
  const COLS = 19;
  const ROWS = 21;
  let TILE = 28;

  // Map legend:
  // X = wall, . = pellet, o = power pellet, space = empty corridor
  // P = Pac-Man, R/K/B/O = ghosts (Blinky/Pinky/Inky/Clyde).
  // K is used for Pinky because P is already reserved for Pac-Man.
  // T = tunnel (wrap)
  // Ghost house is open horizontally so ghosts can leave immediately
  const MAP = [
    "XXXXXXXXXXXXXXXXXXX",
    "X........X........X",
    "X.XX.XXX.X.XXX.XX.X",
    "Xo...............oX",
    "X.XX.X.XXXXX.X.XX.X",
    "X....X...X...X....X",
    "XXXX.XXX.X.XXX.XXXX",
    "   X.X       X.X   ",
    "XXXX.X.XX XX.X.XXXX",
    "T     R B K O     T",
    "XXXX.X.XXXXX.X.XXXX",
    "   X.X       X.X   ",
    "XXXX.X.XXXXX.X.XXXX",
    "X........X........X",
    "X.XX.XXX.X.XXX.XX.X",
    "Xo.X.....P.....X.oX",
    "XX.X.X.XXXXX.X.X.XX",
    "X....X...X...X....X",
    "X.XXXXXX.X.XXXXXX.X",
    "X.................X",
    "XXXXXXXXXXXXXXXXXXX",
  ];

  const DIRS = {
    U: { x: 0, y: -1 },
    D: { x: 0, y: 1 },
    L: { x: -1, y: 0 },
    R: { x: 1, y: 0 },
  };
  const DIR_KEYS = ["U", "D", "L", "R"];
  const OPPOSITE = { U: "D", D: "U", L: "R", R: "L" };

  const GHOST_COLORS = {
    R: "#ff2a6d",
    P: "#ff79c6",
    B: "#00d4ff",
    O: "#ff9f43",
  };
  const SCARED_COLOR = "#4a6bff";
  const EYES_COLOR = "#c8d0ff";

  // ─── DOM ─────────────────────────────────────────────────────
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
  const startModal = document.getElementById("startModal");
  const gameOverModal = document.getElementById("gameOverModal");
  const levelModal = document.getElementById("levelModal");
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");
  const finalScoreEl = document.getElementById("finalScore");
  const finalStatsEl = document.getElementById("finalStats");
  const levelMsgEl = document.getElementById("levelMsg");

  // ─── State ───────────────────────────────────────────────────
  let walls = [];
  let pellets = [];
  let powerPellets = [];
  let pacman = null;
  let ghosts = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let isPlaying = false;
  let gameOver = false;
  let isLevelTransitioning = false;
  let powerMode = false;
  let powerTimer = 0;
  let ghostEatScore = 200;
  let lastTime = 0;
  let mouthOpen = true;
  let mouthTimer = 0;

  // ─── Helpers ─────────────────────────────────────────────────
  function scaleTile() {
    const container = document.querySelector(".container");
    const containerStyle = getComputedStyle(container);
    const verticalPadding =
      parseFloat(containerStyle.paddingTop) + parseFloat(containerStyle.paddingBottom);
    const gap = parseFloat(containerStyle.rowGap) || 0;
    const otherContentHeight = [...container.children]
      .filter((child) => !child.classList.contains("board-wrapper"))
      .reduce((height, child) => height + child.getBoundingClientRect().height, 0);
    const maxW = Math.min(window.innerWidth - 40, 620);
    const maxH = Math.max(
      ROWS * 8,
      window.innerHeight - otherContentHeight - gap * 3 - verticalPadding - 16
    );
    TILE = Math.floor(Math.min(maxW / COLS, maxH / ROWS));
    TILE = Math.max(8, Math.min(TILE, 32));
    canvas.width = COLS * TILE;
    canvas.height = ROWS * TILE;
  }

  function cellCenter(c, r) {
    return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
  }

  function loadMap() {
    walls = [];
    pellets = [];
    powerPellets = [];
    ghosts = [];
    pacman = null;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = MAP[r][c];
        const { x, y } = cellCenter(c, r);

        if (ch === "X") {
          walls.push({ c, r, x: c * TILE, y: r * TILE });
        } else if (ch === ".") {
          pellets.push({ c, r, x, y });
        } else if (ch === "o") {
          powerPellets.push({ c, r, x, y });
        } else if (ch === "P") {
          pacman = createActor(c, r, "L");
        } else if ("RKBO".includes(ch)) {
          // Start facing outward so they leave the house immediately
          const startDir = c < 9 ? "L" : "R";
          const g = createActor(c, r, startDir);
          g.type = ch === "K" ? "P" : ch;
          g.color = GHOST_COLORS[g.type];
          g.scared = false;
          g.eaten = false;
          g.home = { c, r };
          ghosts.push(g);
        }
      }
    }
  }

  function createActor(c, r, dir) {
    const { x, y } = cellCenter(c, r);
    return { c, r, x, y, dir, nextDir: null };
  }

  function isWall(c, r) {
    if (r < 0 || r >= ROWS) return true;
    if (c < 0 || c >= COLS) return r !== 9; // wrap only through the marked tunnel row
    return MAP[r][c] === "X";
  }

  function canMove(actor, dir) {
    const d = DIRS[dir];
    const nc = Math.round(actor.c) + d.x;
    const nr = Math.round(actor.r) + d.y;
    return !isWall(nc, nr);
  }

  function wrap(actor) {
    if (actor.c < -0.5) actor.c = COLS - 0.5;
    if (actor.c > COLS - 0.5) actor.c = -0.5;
  }

  // ─── Neon drawing ────────────────────────────────────────────
  function drawBackground() {
    ctx.fillStyle = "#0a0a18";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(0, 255, 157, 0.04)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * TILE, 0);
      ctx.lineTo(c * TILE, canvas.height);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * TILE);
      ctx.lineTo(canvas.width, r * TILE);
      ctx.stroke();
    }
  }

  function roundRectPath(x, y, w, h, rad) {
    const r = Math.min(rad, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawWalls() {
    const pad = TILE * 0.12;
    const radius = TILE * 0.18;

    for (const w of walls) {
      const x = w.x + pad;
      const y = w.y + pad;
      const s = TILE - pad * 2;

      // Glow stroke
      ctx.shadowColor = "#00d4ff";
      ctx.shadowBlur = 10;
      ctx.strokeStyle = "#00d4ff";
      ctx.lineWidth = Math.max(1.5, TILE * 0.08);
      ctx.beginPath();
      roundRectPath(x, y, s, s, radius);
      ctx.stroke();

      // Fill
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(10, 30, 70, 0.65)";
      ctx.beginPath();
      roundRectPath(x, y, s, s, radius);
      ctx.fill();

      // Inner edge highlight
      ctx.strokeStyle = "rgba(120, 200, 255, 0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      roundRectPath(x + 1.5, y + 1.5, s - 3, s - 3, Math.max(0, radius - 1));
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  function drawPellets() {
    const r = Math.max(2, TILE * 0.12);
    ctx.shadowColor = "#ffe066";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#ffe066";
    for (const p of pellets) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawPowerPellets(time) {
    const pulse = 0.65 + 0.35 * Math.sin(time / 140);
    const r = Math.max(5, TILE * 0.28) * pulse;

    for (const p of powerPellets) {
      ctx.shadowColor = "#00ff9d";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "rgba(0, 255, 157, 0.3)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 10;
      ctx.fillStyle = "#00ff9d";
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.beginPath();
      ctx.arc(p.x - r * 0.25, p.y - r * 0.25, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawPacman() {
    if (!pacman) return;
    const r = TILE * 0.42;
    const mouth = mouthOpen ? 0.4 : 0.08;
    let start, end;

    if (pacman.dir === "R") {
      start = mouth;
      end = Math.PI * 2 - mouth;
    } else if (pacman.dir === "L") {
      start = Math.PI + mouth;
      end = Math.PI - mouth;
    } else if (pacman.dir === "U") {
      start = -Math.PI / 2 + mouth;
      end = -Math.PI / 2 - mouth;
    } else {
      start = Math.PI / 2 + mouth;
      end = Math.PI / 2 - mouth;
    }

    ctx.shadowColor = "#ffe066";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#ffe066";
    ctx.beginPath();
    // Draw the long arc so the gap is the mouth, facing the current direction.
    ctx.arc(pacman.x, pacman.y, r, start, end, false);
    ctx.lineTo(pacman.x, pacman.y);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawGhost(g) {
    const r = TILE * 0.4;
    let color = g.color;

    if (g.eaten) {
      color = EYES_COLOR;
    } else if (g.scared) {
      color =
        powerTimer < 2200 && Math.floor(powerTimer / 180) % 2 === 0
          ? "#ffffff"
          : SCARED_COLOR;
    }

    ctx.shadowColor = g.eaten ? "transparent" : color;
    ctx.shadowBlur = g.eaten ? 0 : 14;
    ctx.fillStyle = color;

    // Body
    ctx.beginPath();
    ctx.arc(g.x, g.y - r * 0.1, r, Math.PI, 0, false);
    const waves = 4;
    const waveW = (r * 2) / waves;
    const baseY = g.y + r * 0.7;
    for (let i = 0; i <= waves; i++) {
      const wx = g.x - r + i * waveW;
      const wy = baseY + (i % 2 === 0 ? 0 : TILE * 0.1);
      ctx.lineTo(wx, wy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    if (g.eaten) {
      drawEyes(g, r, true);
      return;
    }

    // Body highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.beginPath();
    ctx.ellipse(
      g.x - r * 0.2,
      g.y - r * 0.35,
      r * 0.35,
      r * 0.25,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    drawEyes(g, r, false);
  }

  function drawEyes(g, r, pupilsOnly) {
    const eyeR = r * 0.24;
    const eyeOffsetX = r * 0.3;
    const eyeY = g.y - r * 0.22;

    if (!pupilsOnly) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(g.x - eyeOffsetX, eyeY, eyeR, 0, Math.PI * 2);
      ctx.arc(g.x + eyeOffsetX, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
    }

    if (g.scared && !g.eaten) {
      ctx.fillStyle = "#1a1a2e";
      ctx.beginPath();
      ctx.arc(g.x - eyeOffsetX, eyeY, eyeR * 0.4, 0, Math.PI * 2);
      ctx.arc(g.x + eyeOffsetX, eyeY, eyeR * 0.4, 0, Math.PI * 2);
      ctx.fill();
      // Wavy mouth
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const my = g.y + r * 0.25;
      ctx.moveTo(g.x - r * 0.35, my);
      for (let i = 0; i < 4; i++) {
        const mx = g.x - r * 0.35 + ((i + 1) * (r * 0.7)) / 4;
        ctx.lineTo(mx, my + (i % 2 === 0 ? 3 : -3));
      }
      ctx.stroke();
    } else {
      const pupilR = eyeR * 0.5;
      let px = 0,
        py = 0;
      if (g.dir === "L") px = -pupilR * 0.7;
      if (g.dir === "R") px = pupilR * 0.7;
      if (g.dir === "U") py = -pupilR * 0.7;
      if (g.dir === "D") py = pupilR * 0.7;

      ctx.fillStyle = "#1a1a2e";
      ctx.beginPath();
      ctx.arc(g.x - eyeOffsetX + px, eyeY + py, pupilR, 0, Math.PI * 2);
      ctx.arc(g.x + eyeOffsetX + px, eyeY + py, pupilR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw() {
    drawBackground();
    drawWalls();
    drawPellets();
    drawPowerPellets(performance.now());
    for (const g of ghosts) drawGhost(g);
    drawPacman();
  }

  // ─── Movement ────────────────────────────────────────────────
  function tryTurn(actor, dir) {
    if (!dir || !canMove(actor, dir)) return false;
    // AI checks turns on every frame near a tile center. If it keeps the
    // current direction, leave the actor's fractional position alone or it
    // will be snapped back to center every frame and appear frozen.
    if (actor.dir === dir) {
      actor.nextDir = null;
      return true;
    }
    const cx = Math.round(actor.c);
    const cy = Math.round(actor.r);
    const dist = Math.abs(actor.c - cx) + Math.abs(actor.r - cy);
    if (dist > 0.2) return false;
    actor.c = cx;
    actor.r = cy;
    actor.dir = dir;
    actor.nextDir = null;
    return true;
  }

  function moveActor(actor, speed, dt) {
    if (actor.nextDir) tryTurn(actor, actor.nextDir);

    const d = DIRS[actor.dir];
    if (!d) return;

    const step = speed * (dt / 16.67);
    const look = 0.45;
    const checkC =
      d.x !== 0 ? Math.round(actor.c + d.x * look) : Math.round(actor.c);
    const checkR =
      d.y !== 0 ? Math.round(actor.r + d.y * look) : Math.round(actor.r);

    if (isWall(checkC, checkR)) {
      actor.c = Math.round(actor.c);
      actor.r = Math.round(actor.r);
      actor.x = actor.c * TILE + TILE / 2;
      actor.y = actor.r * TILE + TILE / 2;
      return;
    }

    actor.c += d.x * step;
    actor.r += d.y * step;
    wrap(actor);
    actor.x = actor.c * TILE + TILE / 2;
    actor.y = actor.r * TILE + TILE / 2;
  }

  function getValidDirs(g, allowReverse) {
    return DIR_KEYS.filter((d) => {
      if (!allowReverse && d === OPPOSITE[g.dir]) return false;
      return canMove(g, d);
    });
  }

  function ghostAI(g) {
    const cx = Math.round(g.c);
    const cy = Math.round(g.r);
    const dist = Math.abs(g.c - cx) + Math.abs(g.r - cy);
    if (dist > 0.15) return;

    // Eaten → go home
    if (g.eaten) {
      if (Math.abs(g.c - g.home.c) < 0.4 && Math.abs(g.r - g.home.r) < 0.4) {
        g.eaten = false;
        g.scared = powerMode;
        g.dir = g.c < 9 ? "L" : "R";
        g.nextDir = null;
        return;
      }
      const options = getValidDirs(g, true);
      if (!options.length) return;
      let best = options[0];
      let bestDist = Infinity;
      for (const d of options) {
        const nc = cx + DIRS[d].x;
        const nr = cy + DIRS[d].y;
        const dd = Math.abs(nc - g.home.c) + Math.abs(nr - g.home.r);
        if (dd < bestDist) {
          bestDist = dd;
          best = d;
        }
      }
      g.nextDir = best;
      tryTurn(g, best);
      return;
    }

    let options = getValidDirs(g, false);
    if (!options.length) options = getValidDirs(g, true);
    if (!options.length) return;

    if (options.length === 1) {
      g.nextDir = options[0];
      tryTurn(g, options[0]);
      return;
    }

    if (g.scared) {
      let best = options[0];
      let bestDist = -1;
      for (const d of options) {
        const nc = cx + DIRS[d].x;
        const nr = cy + DIRS[d].y;
        const dd = Math.abs(nc - pacman.c) + Math.abs(nr - pacman.r);
        if (dd > bestDist) {
          bestDist = dd;
          best = d;
        }
      }
      g.nextDir = best;
    } else {
      if (Math.random() < 0.3) {
        g.nextDir = options[Math.floor(Math.random() * options.length)];
      } else {
        let best = options[0];
        let bestDist = Infinity;
        for (const d of options) {
          const nc = cx + DIRS[d].x;
          const nr = cy + DIRS[d].y;
          const dd = Math.abs(nc - pacman.c) + Math.abs(nr - pacman.r);
          if (dd < bestDist) {
            bestDist = dd;
            best = d;
          }
        }
        g.nextDir = best;
      }
    }
    tryTurn(g, g.nextDir);
  }

  // ─── Collisions ──────────────────────────────────────────────
  function checkPellet() {
    const pc = Math.round(pacman.c);
    const pr = Math.round(pacman.r);

    for (let i = pellets.length - 1; i >= 0; i--) {
      if (pellets[i].c === pc && pellets[i].r === pr) {
        pellets.splice(i, 1);
        score += 10;
        updateHUD();
        return;
      }
    }
    for (let i = powerPellets.length - 1; i >= 0; i--) {
      if (powerPellets[i].c === pc && powerPellets[i].r === pr) {
        powerPellets.splice(i, 1);
        score += 50;
        activatePower();
        updateHUD();
        return;
      }
    }
  }

  function activatePower() {
    powerMode = true;
    powerTimer = Math.max(4000, 8000 - (level - 1) * 600);
    ghostEatScore = 200;
    for (const g of ghosts) {
      if (!g.eaten) {
        g.scared = true;
        g.dir = OPPOSITE[g.dir] || g.dir;
        g.nextDir = null;
      }
    }
  }

  function checkGhostCollision() {
    for (const g of ghosts) {
      if (Math.hypot(g.x - pacman.x, g.y - pacman.y) < TILE * 0.55) {
        if (g.scared && !g.eaten) {
          g.eaten = true;
          g.scared = false;
          score += ghostEatScore;
          ghostEatScore = Math.min(ghostEatScore * 2, 1600);
          updateHUD();
        } else if (!g.eaten && !g.scared) {
          loseLife();
          return;
        }
      }
    }
  }

  function loseLife() {
    lives--;
    updateHUD();
    if (lives <= 0) {
      endGame();
      return;
    }
    resetActors();
  }

  function resetActors() {
    const remainingPellets = pellets;
    const remainingPowerPellets = powerPellets;
    loadMap();
    pellets = remainingPellets;
    powerPellets = remainingPowerPellets;
    powerMode = false;
    powerTimer = 0;
    for (const g of ghosts) {
      g.scared = false;
      g.eaten = false;
    }
  }

  function checkLevelClear() {
    if (
      !isLevelTransitioning &&
      pellets.length === 0 &&
      powerPellets.length === 0
    ) {
      isLevelTransitioning = true;
      level++;
      score += 500 * (level - 1);
      updateHUD();
      levelMsgEl.textContent = `Level ${level}`;
      levelModal.classList.remove("hidden");
      setTimeout(() => {
        levelModal.classList.add("hidden");
        loadMap();
        powerMode = false;
        powerTimer = 0;
        isLevelTransitioning = false;
      }, 1400);
    }
  }

  function updateHUD() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    livesEl.textContent = "★".repeat(Math.max(0, lives)) || "—";
  }

  // ─── Game loop ───────────────────────────────────────────────
  function loop(time) {
    if (!isPlaying || gameOver) return;

    const dt = Math.min(time - lastTime, 40);
    lastTime = time;

    if (isLevelTransitioning) {
      draw();
      requestAnimationFrame(loop);
      return;
    }

    mouthTimer += dt;
    if (mouthTimer > 110) {
      mouthOpen = !mouthOpen;
      mouthTimer = 0;
    }

    if (powerMode) {
      powerTimer -= dt;
      if (powerTimer <= 0) {
        powerMode = false;
        for (const g of ghosts) {
          if (!g.eaten) g.scared = false;
        }
      }
    }

    const difficulty = Math.min(level - 1, 12);
    const pacSpeed = (0.09 + difficulty * 0.005) * (TILE / 28);
    const ghostBase = (0.075 + difficulty * 0.004) * (TILE / 28);
    const ghostSpeed = powerMode ? ghostBase * 0.65 : ghostBase;
    const eatenSpeed = 0.14 * (TILE / 28);

    moveActor(pacman, pacSpeed, dt);
    checkPellet();
    checkGhostCollision();
    checkLevelClear();

    for (const g of ghosts) {
      ghostAI(g);
      moveActor(g, g.eaten ? eatenSpeed : ghostSpeed, dt);
    }

    draw();
    requestAnimationFrame(loop);
  }

  // ─── Input ───────────────────────────────────────────────────
  function setDir(dir) {
    if (!isPlaying || gameOver || !pacman) return;
    pacman.nextDir = dir;
    tryTurn(pacman, dir);
  }

  document.addEventListener("keydown", (e) => {
    const key = e.key;
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        " ",
        "w",
        "a",
        "s",
        "d",
        "W",
        "A",
        "S",
        "D",
      ].includes(key)
    ) {
      e.preventDefault();
    }

    if (key === " " || key === "Spacebar") {
      if (gameOver || !isPlaying) startGame();
      return;
    }

    if (key === "ArrowUp" || key === "w" || key === "W") setDir("U");
    else if (key === "ArrowDown" || key === "s" || key === "S") setDir("D");
    else if (key === "ArrowLeft" || key === "a" || key === "A") setDir("L");
    else if (key === "ArrowRight" || key === "d" || key === "D") setDir("R");
  });

  let touchX = 0,
    touchY = 0;
  document.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) {
        touchX = e.touches[0].clientX;
        touchY = e.touches[0].clientY;
      }
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    (e) => {
      if (!isPlaying || gameOver) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchX;
      const dy = t.clientY - touchY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return;
      if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? "R" : "L");
      else setDir(dy > 0 ? "D" : "U");
    },
    { passive: true }
  );

  document.querySelector(".board-wrapper")?.addEventListener(
    "touchmove",
    (e) => {
      if (isPlaying) e.preventDefault();
    },
    { passive: false }
  );

  // ─── Start / Restart ─────────────────────────────────────────
  function startGame() {
    scaleTile();
    score = 0;
    lives = 3;
    level = 1;
    gameOver = false;
    isLevelTransitioning = false;
    isPlaying = true;
    powerMode = false;
    powerTimer = 0;
    loadMap();
    updateHUD();
    startModal.classList.add("hidden");
    gameOverModal.classList.add("hidden");
    levelModal.classList.add("hidden");
    document.body.classList.add("playing");
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function endGame() {
    gameOver = true;
    isPlaying = false;
    document.body.classList.remove("playing");
    finalScoreEl.textContent = `Score: ${score}`;
    finalStatsEl.textContent = `Level ${level}`;
    gameOverModal.classList.remove("hidden");
  }

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

  scaleTile();
  loadMap();
  draw();

  window.addEventListener("resize", () => {
    scaleTile();
    if (pacman) {
      pacman.x = pacman.c * TILE + TILE / 2;
      pacman.y = pacman.r * TILE + TILE / 2;
    }
    for (const g of ghosts) {
      g.x = g.c * TILE + TILE / 2;
      g.y = g.r * TILE + TILE / 2;
    }
    for (const p of pellets) {
      const pos = cellCenter(p.c, p.r);
      p.x = pos.x;
      p.y = pos.y;
    }
    for (const p of powerPellets) {
      const pos = cellCenter(p.c, p.r);
      p.x = pos.x;
      p.y = pos.y;
    }
    draw();
  });
})();
