(() => {
  "use strict";

  // ─── Constants ───────────────────────────────────────────────
  const COLS = 19;
  const ROWS = 21;
  let TILE = 28; // will scale to fit screen

  // Map legend:
  // X = wall, . = pellet, o = power pellet,   = empty
  // P = pacman start, R/P/B/O = ghost starts (red/pink/blue/orange)
  // T = tunnel (empty, wraps)
  const MAP = [
    "XXXXXXXXXXXXXXXXXXX",
    "X........X........X",
    "X.XX.XXX.X.XXX.XX.X",
    "Xo...............oX",
    "X.XX.X.XXXXX.X.XX.X",
    "X....X...X...X....X",
    "XXXX.XXX.X.XXX.XXXX",
    "   X.X.......X.X   ",
    "XXXX.X.XXrXX.X.XXXX",
    "T.....Bb pO......T",
    "XXXX.X.XXXXX.X.XXXX",
    "   X.X.......X.X   ",
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
    R: "#ff2a6d", // Blinky – red/pink
    P: "#ff79c6", // Pinky
    B: "#00d4ff", // Inky – cyan
    O: "#ff9f43", // Clyde – orange
  };
  const SCARED_COLOR = "#3a5cff";
  const EYES_ONLY = "#e0e0ff";

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
  let powerMode = false;
  let powerTimer = 0;
  let ghostEatScore = 200;
  let animFrame = 0;
  let lastTime = 0;
  let mouthOpen = true;
  let mouthTimer = 0;

  // ─── Helpers ─────────────────────────────────────────────────
  function scaleTile() {
    const maxW = Math.min(window.innerWidth - 40, 620);
    const maxH = window.innerHeight - 220;
    TILE = Math.floor(Math.min(maxW / COLS, maxH / ROWS));
    TILE = Math.max(16, Math.min(TILE, 32));
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
          pacman = createActor(c, r, "R");
        } else if ("RPBO".includes(ch)) {
          const g = createActor(c, r, "U");
          g.type = ch;
          g.color = GHOST_COLORS[ch];
          g.scared = false;
          g.eaten = false;
          g.home = { c, r };
          ghosts.push(g);
        }
        // space and T are walkable empty
      }
    }
  }

  function createActor(c, r, dir) {
    const { x, y } = cellCenter(c, r);
    return {
      c,
      r,
      x,
      y,
      dir,
      nextDir: null,
      speed: 0,
    };
  }

  function isWall(c, r) {
    if (r < 0 || r >= ROWS) return true;
    // horizontal tunnel wrap
    if (c < 0 || c >= COLS) return false;
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

  // ─── Drawing (pure canvas, neon style) ───────────────────────
  function drawWalls() {
    ctx.strokeStyle = "#1a6bff";
    ctx.lineWidth = Math.max(2, TILE * 0.12);
    ctx.shadowColor = "#1a6bff";
    ctx.shadowBlur = 8;
    ctx.lineJoin = "round";

    // Draw walls as rounded rectangles with glow
    for (const w of walls) {
      const pad = TILE * 0.08;
      ctx.strokeRect(w.x + pad, w.y + pad, TILE - pad * 2, TILE - pad * 2);
    }
    ctx.shadowBlur = 0;
  }

  function drawPellets() {
    ctx.fillStyle = "#ffe066";
    ctx.shadowColor = "#ffe066";
    ctx.shadowBlur = 4;
    const r = Math.max(2, TILE * 0.1);
    for (const p of pellets) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawPowerPellets(time) {
    const pulse = 0.7 + 0.3 * Math.sin(time / 150);
    const r = Math.max(4, TILE * 0.22) * pulse;
    ctx.fillStyle = "#00ff9d";
    ctx.shadowColor = "#00ff9d";
    ctx.shadowBlur = 12;
    for (const p of powerPellets) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawPacman() {
    if (!pacman) return;
    const r = TILE * 0.4;
    let start = 0.25;
    let end = 1.75;

    // Mouth direction
    const mouth = mouthOpen ? 0.35 : 0.05;
    if (pacman.dir === "R") {
      start = mouth;
      end = Math.PI * 2 - mouth;
    } else if (pacman.dir === "L") {
      start = Math.PI + mouth;
      end = Math.PI - mouth;
    } else if (pacman.dir === "U") {
      start = -Math.PI / 2 + mouth;
      end = -Math.PI / 2 - mouth + Math.PI * 2;
    } else if (pacman.dir === "D") {
      start = Math.PI / 2 + mouth;
      end = Math.PI / 2 - mouth;
    }

    ctx.fillStyle = "#ffe066";
    ctx.shadowColor = "#ffe066";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(pacman.x, pacman.y, r, start, end, false);
    ctx.lineTo(pacman.x, pacman.y);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawGhost(g) {
    const r = TILE * 0.4;
    const bodyH = r * 1.15;
    let color = g.color;
    if (g.eaten) color = EYES_ONLY;
    else if (g.scared) {
      // blink near end of power mode
      if (powerTimer < 2000 && Math.floor(powerTimer / 200) % 2 === 0) {
        color = "#fff";
      } else {
        color = SCARED_COLOR;
      }
    }

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = g.eaten ? 0 : 12;

    // Body (semi-circle + wavy bottom)
    ctx.beginPath();
    ctx.arc(g.x, g.y - r * 0.15, r, Math.PI, 0, false);
    const waves = 3;
    const waveW = (r * 2) / waves;
    for (let i = 0; i <= waves; i++) {
      const wx = g.x - r + i * waveW;
      const wy = g.y + bodyH * 0.55 + (i % 2 === 0 ? 0 : TILE * 0.08);
      if (i === 0) ctx.lineTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Eyes
    const eyeR = r * 0.22;
    const eyeOffsetX = r * 0.28;
    const eyeY = g.y - r * 0.25;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(g.x - eyeOffsetX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.arc(g.x + eyeOffsetX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // Pupils (look toward pacman or direction)
    if (!g.scared || g.eaten) {
      const pupilR = eyeR * 0.5;
      let px = 0,
        py = 0;
      if (g.dir === "L") px = -pupilR * 0.6;
      if (g.dir === "R") px = pupilR * 0.6;
      if (g.dir === "U") py = -pupilR * 0.6;
      if (g.dir === "D") py = pupilR * 0.6;
      ctx.fillStyle = "#1a1a2e";
      ctx.beginPath();
      ctx.arc(g.x - eyeOffsetX + px, eyeY + py, pupilR, 0, Math.PI * 2);
      ctx.arc(g.x + eyeOffsetX + px, eyeY + py, pupilR, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // scared eyes – simple dots
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(g.x - eyeOffsetX, eyeY, eyeR * 0.35, 0, Math.PI * 2);
      ctx.arc(g.x + eyeOffsetX, eyeY, eyeR * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // subtle grid
    ctx.strokeStyle = "rgba(0, 255, 157, 0.03)";
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

    drawWalls();
    drawPellets();
    drawPowerPellets(performance.now());
    for (const g of ghosts) drawGhost(g);
    drawPacman();
  }

  // ─── Movement ────────────────────────────────────────────────
  function tryTurn(actor, dir) {
    if (!dir || !canMove(actor, dir)) return false;
    // only turn when roughly centered on a tile
    const cx = Math.round(actor.c);
    const cy = Math.round(actor.r);
    const dist = Math.abs(actor.c - cx) + Math.abs(actor.r - cy);
    if (dist > 0.15) return false;
    actor.c = cx;
    actor.r = cy;
    actor.dir = dir;
    actor.nextDir = null;
    return true;
  }

  function moveActor(actor, speed, dt) {
    if (actor.nextDir) tryTurn(actor, actor.nextDir);

    const d = DIRS[actor.dir];
    const step = speed * (dt / 16.67);

    // check if next step would hit wall
    const testC = actor.c + d.x * step;
    const testR = actor.r + d.y * step;
    const checkC = d.x !== 0 ? Math.round(testC + d.x * 0.4) : Math.round(actor.c);
    const checkR = d.y !== 0 ? Math.round(testR + d.y * 0.4) : Math.round(actor.r);

    if (isWall(checkC, checkR)) {
      // snap to center
      actor.c = Math.round(actor.c);
      actor.r = Math.round(actor.r);
      return;
    }

    actor.c = testC;
    actor.r = testR;
    wrap(actor);
    actor.x = actor.c * TILE + TILE / 2;
    actor.y = actor.r * TILE + TILE / 2;
  }

  function ghostAI(g) {
    // If eaten, go home
    if (g.eaten) {
      const hc = g.home.c;
      const hr = g.home.r;
      if (Math.abs(g.c - hc) < 0.3 && Math.abs(g.r - hr) < 0.3) {
        g.eaten = false;
        g.scared = powerMode;
        return;
      }
      // simple path toward home
      const options = DIR_KEYS.filter((d) => d !== OPPOSITE[g.dir] && canMove(g, d));
      if (options.length === 0) return;
      let best = options[0];
      let bestDist = Infinity;
      for (const d of options) {
        const nc = Math.round(g.c) + DIRS[d].x;
        const nr = Math.round(g.r) + DIRS[d].y;
        const dist = Math.abs(nc - hc) + Math.abs(nr - hr);
        if (dist < bestDist) {
          bestDist = dist;
          best = d;
        }
      }
      g.nextDir = best;
      return;
    }

    // At decision points (intersection), pick a direction
    const options = DIR_KEYS.filter((d) => d !== OPPOSITE[g.dir] && canMove(g, d));
    if (options.length <= 1) {
      if (options.length === 1) g.nextDir = options[0];
      return;
    }

    // Centered enough to decide?
    const cx = Math.round(g.c);
    const cy = Math.round(g.r);
    if (Math.abs(g.c - cx) + Math.abs(g.r - cy) > 0.12) return;

    if (g.scared) {
      // run away from pacman
      let best = options[0];
      let bestDist = -1;
      for (const d of options) {
        const nc = cx + DIRS[d].x;
        const nr = cy + DIRS[d].y;
        const dist = Math.abs(nc - pacman.c) + Math.abs(nr - pacman.r);
        if (dist > bestDist) {
          bestDist = dist;
          best = d;
        }
      }
      g.nextDir = best;
    } else {
      // chase pacman with some randomness
      if (Math.random() < 0.25) {
        g.nextDir = options[Math.floor(Math.random() * options.length)];
      } else {
        let best = options[0];
        let bestDist = Infinity;
        for (const d of options) {
          const nc = cx + DIRS[d].x;
          const nr = cy + DIRS[d].y;
          const dist = Math.abs(nc - pacman.c) + Math.abs(nr - pacman.r);
          if (dist < bestDist) {
            bestDist = dist;
            best = d;
          }
        }
        g.nextDir = best;
      }
    }
  }

  // ─── Collisions & game logic ─────────────────────────────────
  function checkPellet() {
    const pc = Math.round(pacman.c);
    const pr = Math.round(pacman.r);

    for (let i = pellets.length - 1; i >= 0; i--) {
      const p = pellets[i];
      if (p.c === pc && p.r === pr) {
        pellets.splice(i, 1);
        score += 10;
        updateHUD();
        return;
      }
    }

    for (let i = powerPellets.length - 1; i >= 0; i--) {
      const p = powerPellets[i];
      if (p.c === pc && p.r === pr) {
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
    powerTimer = 8000 - Math.min(level - 1, 5) * 500; // shorter on higher levels
    ghostEatScore = 200;
    for (const g of ghosts) {
      if (!g.eaten) {
        g.scared = true;
        // reverse direction
        g.dir = OPPOSITE[g.dir] || g.dir;
        g.nextDir = null;
      }
    }
  }

  function checkGhostCollision() {
    for (const g of ghosts) {
      const dist = Math.hypot(g.x - pacman.x, g.y - pacman.y);
      if (dist < TILE * 0.55) {
        if (g.scared && !g.eaten) {
          // eat ghost
          g.eaten = true;
          g.scared = false;
          score += ghostEatScore;
          ghostEatScore *= 2;
          updateHUD();
        } else if (!g.eaten && !g.scared) {
          // die
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
    // reset positions
    resetActors();
  }

  function resetActors() {
    // rebuild from map positions
    const savedScore = score;
    const savedLives = lives;
    const savedLevel = level;
    loadMap();
    score = savedScore;
    lives = savedLives;
    level = savedLevel;
    powerMode = false;
    powerTimer = 0;
    for (const g of ghosts) {
      g.scared = false;
      g.eaten = false;
    }
  }

  function checkLevelClear() {
    if (pellets.length === 0 && powerPellets.length === 0) {
      level++;
      score += 500 * (level - 1);
      updateHUD();
      showLevelClear();
      setTimeout(() => {
        levelModal.classList.add("hidden");
        loadMap();
        powerMode = false;
        powerTimer = 0;
      }, 1500);
    }
  }

  function showLevelClear() {
    levelMsgEl.textContent = `Level ${level}`;
    levelModal.classList.remove("hidden");
  }

  function updateHUD() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    livesEl.textContent = "★".repeat(Math.max(0, lives)) || "—";
  }

  // ─── Game loop ───────────────────────────────────────────────
  function loop(time) {
    if (!isPlaying || gameOver) return;

    const dt = Math.min(time - lastTime, 50);
    lastTime = time;

    // Mouth animation
    mouthTimer += dt;
    if (mouthTimer > 120) {
      mouthOpen = !mouthOpen;
      mouthTimer = 0;
    }

    // Power mode timer
    if (powerMode) {
      powerTimer -= dt;
      if (powerTimer <= 0) {
        powerMode = false;
        for (const g of ghosts) {
          if (!g.eaten) g.scared = false;
        }
      }
    }

    // Speeds
    const pacSpeed = (0.085 + level * 0.004) * (TILE / 28);
    const ghostSpeed = powerMode
      ? (0.05 + level * 0.002) * (TILE / 28)
      : (0.07 + level * 0.0035) * (TILE / 28);
    const eatenSpeed = 0.12 * (TILE / 28);

    moveActor(pacman, pacSpeed, dt);
    checkPellet();
    checkGhostCollision();
    checkLevelClear();

    for (const g of ghosts) {
      ghostAI(g);
      const spd = g.eaten ? eatenSpeed : ghostSpeed;
      moveActor(g, spd, dt);
    }

    draw();
    requestAnimationFrame(loop);
  }

  // ─── Input ───────────────────────────────────────────────────
  function setDir(dir) {
    if (!isPlaying || gameOver || !pacman) return;
    pacman.nextDir = dir;
    // allow instant turn if possible
    tryTurn(pacman, dir);
  }

  document.addEventListener("keydown", (e) => {
    const key = e.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "a", "s", "d", "W", "A", "S", "D"].includes(key)) {
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

  // Swipe
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
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (Math.max(absX, absY) < 25) return;
      if (absX > absY) setDir(dx > 0 ? "R" : "L");
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

  // Initial setup – show empty board under modal
  scaleTile();
  loadMap();
  draw();
  window.addEventListener("resize", () => {
    scaleTile();
    // re-sync pixel positions
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
