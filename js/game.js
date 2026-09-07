(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMsg = document.getElementById("overlay-msg");
  const btnStart = document.getElementById("btn-start");

  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = H - 64;
  const GRAVITY = 0.25;
  const JUMP_V = -9.2;
  const STORAGE_KEY = "after-work-dash-best";
  /** Slow start; every SCORE_STEP points, speed +1 up to MAX_SPEED */
  const BASE_SPEED = 1.5;
  const SCORE_STEP = 100;
  const MAX_SPEED = 8;
  /** Minimum gap between obstacles (px) */
  const MIN_OBSTACLE_GAP = 320;

  function speedForScore(score) {
    const tier = (score / SCORE_STEP) | 0;
    return Math.min(MAX_SPEED, BASE_SPEED + tier);
  }

  const PLAYER_H_STAND = 56;
  const PLAYER_H_DUCK = 32; // collision only — short so flyers pass over
  const PLAYER_H_DUCK_DRAW = 50; // visual crouch pose (not a shrink of stand)
  const PLAYER_W = 44;

  const OBSTACLE_TYPES = [
    { key: "spikes", w: 56, h: 36, needDuck: false },
    { key: "rock", w: 52, h: 44, needDuck: false },
    { key: "bricks", w: 48, h: 48, needDuck: false },
    { key: "crate_spike", w: 48, h: 48, needDuck: false },
    { key: "puddle", w: 72, h: 28, needDuck: false },
    { key: "slime", w: 52, h: 40, needDuck: false },
    { key: "flyer", w: 56, h: 44, needDuck: true },
    { key: "flyer2", w: 56, h: 44, needDuck: true },
    { key: "saw", w: 52, h: 52, needDuck: true },
  ];

  const SPRITE_SRCS = {
    walkA: "assets/sprites/player_walk_a.png",
    walkB: "assets/sprites/player_walk_b.png",
    jump: "assets/sprites/player_jump.png",
    idle: "assets/sprites/player_idle.png",
    duck: "assets/sprites/player_duck.png",
    spikes: "assets/sprites/spikes.png",
    rock: "assets/sprites/rock.png",
    bricks: "assets/sprites/bricks.png",
    crate_spike: "assets/sprites/crate_spike.png",
    puddle: "assets/sprites/puddle.png",
    slime: "assets/sprites/slime.png",
    flyer: "assets/sprites/flyer.png",
    flyer2: "assets/sprites/flyer2.png",
    saw: "assets/sprites/saw.png",
  };

  const sprites = {};
  let assetsReady = false;

  const DEATH_LINES = [
    "Spikes. Classic commute.",
    "Rock says hello.",
    "Brick wall 1, you 0.",
    "Spiked crate — office supplies optional.",
    "Puddle too deep. Socks: retired.",
    "Slime on the sidewalk. Gross.",
    "Forgot to duck. Bonked.",
    "Sawblade says keep your head down.",
    "So close to home…",
  ];

  let best = Number(localStorage.getItem(STORAGE_KEY) || 0);
  bestEl.textContent = String(best);

  const keys = { down: false };
  let duckUntil = 0;

  const state = {
    running: false,
    gameOver: false,
    score: 0,
    speed: BASE_SPEED,
    distance: 0,
    nextSpawn: 160,
    player: null,
    obstacles: [],
    clouds: [],
    groundOffset: 0,
    raf: 0,
  };

  function resetPlayer() {
    state.player = {
      x: 80,
      y: GROUND_Y - PLAYER_H_STAND,
      w: PLAYER_W,
      h: PLAYER_H_STAND,
      vy: 0,
      onGround: true,
      ducking: false,
    };
  }

  function applyDuckStance() {
    const p = state.player;
    if (!p) return;
    const wantDuck = (keys.down || performance.now() < duckUntil) && p.onGround && state.running;
    if (wantDuck === p.ducking && p.h === (wantDuck ? PLAYER_H_DUCK : PLAYER_H_STAND)) {
      if (p.onGround) p.y = GROUND_Y - p.h;
      return;
    }
    p.ducking = wantDuck;
    p.h = wantDuck ? PLAYER_H_DUCK : PLAYER_H_STAND;
    if (p.onGround) p.y = GROUND_Y - p.h;
  }

  function resetGame() {
    state.running = true;
    state.gameOver = false;
    state.score = 0;
    state.speed = BASE_SPEED;
    state.distance = 0;
    state.nextSpawn = 160;
    state.obstacles = [];
    state.groundOffset = 0;
    resetPlayer();
    scoreEl.textContent = "0";
    overlay.classList.add("hidden");
    if (!state.raf) loop();
  }

  function spawnObstacle() {
    const groundTypes = OBSTACLE_TYPES.filter((t) => !t.needDuck);
    const airTypes = OBSTACLE_TYPES.filter((t) => t.needDuck);
    const useAir = airTypes.length && Math.random() < 0.38;
    const type = useAir
      ? airTypes[(Math.random() * airTypes.length) | 0]
      : groundTypes[(Math.random() * groundTypes.length) | 0];
    const spawnX = W + 20;
    // Aerial hazards sit in standing hitbox height so ducking slips under
    const y = type.needDuck ? GROUND_Y - type.h - 42 : GROUND_Y - type.h;
    state.obstacles.push({
      ...type,
      x: spawnX,
      y,
    });
  }

  function canSpawnObstacle() {
    const last = state.obstacles[state.obstacles.length - 1];
    if (!last) return true;
    const spawnX = W + 20;
    return spawnX - (last.x + last.w) >= MIN_OBSTACLE_GAP;
  }

  function jump() {
    if (!state.running || state.gameOver) return;
    const p = state.player;
    if (p.ducking) return;
    if (p.onGround) {
      p.vy = JUMP_V;
      p.onGround = false;
      p.ducking = false;
      p.h = PLAYER_H_STAND;
    }
  }

  function rectsOverlap(a, b) {
    const pad = 4;
    return (
      a.x + pad < b.x + b.w - pad &&
      a.x + a.w - pad > b.x + pad &&
      a.y + pad < b.y + b.h - pad &&
      a.y + a.h - pad > b.y + pad
    );
  }

  function endGame() {
    state.running = false;
    state.gameOver = true;
    if (state.score > best) {
      best = state.score;
      localStorage.setItem(STORAGE_KEY, String(best));
      bestEl.textContent = String(best);
    }
    const line = DEATH_LINES[(Math.random() * DEATH_LINES.length) | 0];
    overlayTitle.textContent = "Dash Over";
    overlayMsg.innerHTML = `${line}<br />Score <strong>${state.score}</strong> · Best <strong>${best}</strong>`;
    btnStart.textContent = "Play Again";
    overlay.classList.remove("hidden");
  }

  function update() {
    if (!state.running) return;

    const p = state.player;
    p.vy += GRAVITY;
    p.y += p.vy;
    if (p.y >= GROUND_Y - p.h) {
      p.y = GROUND_Y - p.h;
      p.vy = 0;
      p.onGround = true;
    }

    applyDuckStance();

    state.speed = speedForScore(state.score);
    state.distance += state.speed;
    state.groundOffset = (state.groundOffset + state.speed) % 40;
    state.score = (state.distance / 10) | 0;
    state.speed = speedForScore(state.score);
    scoreEl.textContent = String(state.score);

    state.nextSpawn -= 1;
    if (state.nextSpawn <= 0 && canSpawnObstacle()) {
      spawnObstacle();
      const tier = state.speed - BASE_SPEED;
      state.nextSpawn = 180 + ((Math.random() * 100) | 0) - Math.min(40, tier * 8);
    } else if (state.nextSpawn <= 0) {
      state.nextSpawn = 12;
    }

    for (const o of state.obstacles) {
      o.x -= state.speed;
    }
    state.obstacles = state.obstacles.filter((o) => o.x + o.w > -10);

    for (const o of state.obstacles) {
      if (rectsOverlap(p, o)) {
        endGame();
        break;
      }
    }
  }

  /** Fixed star field (seeded so they don't jump every frame) */
  const STARS = (() => {
    const list = [];
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 48; i++) {
      list.push({
        x: rand() * W,
        y: rand() * (GROUND_Y * 0.72),
        r: 0.6 + rand() * 1.6,
        phase: rand() * Math.PI * 2,
        twinkle: 0.4 + rand() * 0.6,
      });
    }
    return list;
  })();

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0b1020");
    g.addColorStop(0.45, "#1a2744");
    g.addColorStop(0.75, "#3d3560");
    g.addColorStop(1, "#c4785a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const t = state.distance * 0.02;
    for (const s of STARS) {
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * s.twinkle + s.phase));
      ctx.fillStyle = `rgba(255, 255, 245, ${tw})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Moon + soft glow
    const mx = W - 100;
    const my = 68;
    const mr = 34;
    ctx.fillStyle = "rgba(255, 250, 230, 0.12)";
    ctx.beginPath();
    ctx.arc(mx, my, mr + 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f2ecc9";
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();

    // Crescent cutout
    ctx.fillStyle = "#152238";
    ctx.beginPath();
    ctx.arc(mx + 12, my - 4, mr * 0.92, 0, Math.PI * 2);
    ctx.fill();

    // A few craters on the lit edge
    ctx.fillStyle = "rgba(200, 190, 160, 0.35)";
    ctx.beginPath();
    ctx.arc(mx - 10, my + 6, 4, 0, Math.PI * 2);
    ctx.arc(mx - 4, my - 12, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGround() {
    ctx.fillStyle = "#3d4a3a";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "#2f382c";
    ctx.fillRect(0, GROUND_Y, W, 6);

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    for (let x = -state.groundOffset; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 18);
      ctx.lineTo(x + 18, GROUND_Y + 18);
      ctx.stroke();
    }
  }

  function drawPlayer() {
    const p = state.player;
    let img = sprites.idle;
    if (p.ducking) {
      img = sprites.duck || img;
    } else if (!p.onGround) {
      img = sprites.jump || img;
    } else if (state.running) {
      const frame = ((state.distance / 18) | 0) % 2;
      img = (frame === 0 ? sprites.walkA : sprites.walkB) || img;
    }
    if (img && img.complete) {
      // Keep hitbox short while ducking, but draw the crouch sprite at a natural size
      const drawH = p.ducking ? PLAYER_H_DUCK_DRAW : p.h;
      const scale = drawH / img.height;
      const dw = img.width * scale;
      const dx = p.x + (p.w - dw) / 2;
      // Duck: show full crouch art above feet; otherwise follow physics y (jump arc)
      const dy = p.ducking ? GROUND_Y - drawH : p.y;
      ctx.drawImage(img, dx, dy, dw, drawH);
    } else {
      ctx.fillStyle = "#3d7ea6";
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
  }

  function drawObstacle(o) {
    const img = sprites[o.key];
    if (img && img.complete) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, o.x, o.y, o.w, o.h);
      ctx.imageSmoothingEnabled = true;
      return;
    }
    ctx.fillStyle = "#888";
    ctx.fillRect(o.x, o.y, o.w, o.h);
  }

  function draw() {
    drawSky();
    drawGround();
    for (const o of state.obstacles) drawObstacle(o);
    if (state.player) drawPlayer();

    if (!state.running && !state.gameOver) {
      // idle preview silhouette already drawn after resetPlayer on first paint
    }
  }

  function loop() {
    update();
    draw();
    state.raf = requestAnimationFrame(loop);
  }

  let touchStartY = null;

  function onAction(e) {
    if (e.type === "keydown" && e.code !== "Space" && e.code !== "ArrowUp") return;
    if (e.type === "keydown") e.preventDefault();
    if (!assetsReady) return;
    if (!state.running) {
      resetGame();
      return;
    }
    jump();
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowDown" || e.code === "KeyS") {
      e.preventDefault();
      keys.down = true;
      if (!assetsReady) return;
      if (!state.running) {
        resetGame();
        return;
      }
      applyDuckStance();
      return;
    }
    onAction(e);
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowDown" || e.code === "KeyS") {
      keys.down = false;
      applyDuckStance();
    }
  });

  btnStart.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!assetsReady) return;
    resetGame();
  });

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!assetsReady) return;
    touchStartY = e.clientY;
    if (!state.running) {
      resetGame();
      return;
    }
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!assetsReady || !state.running) {
      touchStartY = null;
      return;
    }
    if (touchStartY == null) return;
    const dy = e.clientY - touchStartY;
    touchStartY = null;
    if (dy > 28) {
      duckUntil = performance.now() + 450;
      applyDuckStance();
      return;
    }
    if (dy < -20) return;
    jump();
  });

  canvas.addEventListener("pointercancel", () => {
    touchStartY = null;
  });

  function loadSprites() {
    const entries = Object.entries(SPRITE_SRCS);
    return Promise.all(
      entries.map(
        ([key, src]) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              sprites[key] = img;
              resolve();
            };
            img.onerror = () => reject(new Error("Failed to load " + src));
            img.src = src;
          })
      )
    );
  }

  overlayTitle.textContent = "After-Work Dash";
  overlayMsg.textContent = "Loading sprites…";
  btnStart.disabled = true;

  loadSprites()
    .then(() => {
      assetsReady = true;
      btnStart.disabled = false;
      overlayMsg.innerHTML =
        "Space / ↑ / tap: jump over ground hazards<br />↓ / S / swipe down: duck under flyers & saws";
      btnStart.textContent = "Start Dash";
      resetPlayer();
      state.obstacles = [];
      draw();
    })
    .catch((err) => {
      console.error(err);
      overlayMsg.textContent = "Failed to load sprites. Check assets/sprites.";
    });
})();
