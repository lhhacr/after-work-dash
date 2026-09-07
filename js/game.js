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
  const GRAVITY = 0.55;
  const JUMP_V = -11.5;
  const STORAGE_KEY = "after-work-dash-best";

  const OBSTACLE_TYPES = [
    { key: "manhole", label: "井盖", w: 42, h: 18, color: "#5a5a5a" },
    { key: "puddle", label: "积水", w: 56, h: 14, color: "#4a90c8" },
    { key: "bike", label: "单车", w: 48, h: 36, color: "#6bcf7f" },
    { key: "cone", label: "路锥", w: 28, h: 40, color: "#f08a24" },
    { key: "trash", label: "垃圾桶", w: 34, h: 44, color: "#7a8b6f" },
    { key: "msg", label: "未读99+", w: 52, h: 32, color: "#e85d4c" },
  ];

  const DEATH_LINES = [
    "栽在井盖上了… 今晚加班取消失败",
    "积水太深，袜子报废",
    "共享单车横着停，你横着倒",
    "施工锥：禁止通行（含打工人）",
    "被未读消息创飞了",
    "差一点就到家…",
    "今日步数：倒地一米",
  ];

  let best = Number(localStorage.getItem(STORAGE_KEY) || 0);
  bestEl.textContent = String(best);

  const state = {
    running: false,
    gameOver: false,
    score: 0,
    speed: 6,
    distance: 0,
    nextSpawn: 90,
    player: null,
    obstacles: [],
    clouds: [],
    groundOffset: 0,
    raf: 0,
  };

  function resetPlayer() {
    state.player = {
      x: 90,
      y: GROUND_Y - 48,
      w: 36,
      h: 48,
      vy: 0,
      onGround: true,
    };
  }

  function resetGame() {
    state.running = true;
    state.gameOver = false;
    state.score = 0;
    state.speed = 6;
    state.distance = 0;
    state.nextSpawn = 80;
    state.obstacles = [];
    state.groundOffset = 0;
    resetPlayer();
    scoreEl.textContent = "0";
    overlay.classList.add("hidden");
    if (!state.raf) loop();
  }

  function spawnObstacle() {
    const type = OBSTACLE_TYPES[(Math.random() * OBSTACLE_TYPES.length) | 0];
    state.obstacles.push({
      ...type,
      x: W + 20,
      y: GROUND_Y - type.h,
    });
  }

  function jump() {
    if (!state.running || state.gameOver) return;
    const p = state.player;
    if (p.onGround) {
      p.vy = JUMP_V;
      p.onGround = false;
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
    overlayTitle.textContent = "冲刺结束";
    overlayMsg.innerHTML = `${line}<br />本局 <strong>${state.score}</strong> · 最高 <strong>${best}</strong>`;
    btnStart.textContent = "再来一把";
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

    state.speed = 6 + Math.min(8, state.distance / 800);
    state.distance += state.speed;
    state.groundOffset = (state.groundOffset + state.speed) % 40;
    state.score = (state.distance / 10) | 0;
    scoreEl.textContent = String(state.score);

    state.nextSpawn -= 1;
    if (state.nextSpawn <= 0) {
      spawnObstacle();
      state.nextSpawn = 55 + ((Math.random() * 55) | 0) - Math.min(25, state.speed * 2);
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

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#2d3a4f");
    g.addColorStop(0.55, "#6b5b7a");
    g.addColorStop(1, "#e8a87c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // sun
    ctx.fillStyle = "rgba(255, 210, 140, 0.85)";
    ctx.beginPath();
    ctx.arc(W - 90, 70, 36, 0, Math.PI * 2);
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
    // body
    ctx.fillStyle = "#3d7ea6";
    ctx.fillRect(p.x + 6, p.y + 14, 24, 26);
    // head
    ctx.fillStyle = "#f0d5b8";
    ctx.fillRect(p.x + 8, p.y, 20, 16);
    // bag
    ctx.fillStyle = "#2a4a5e";
    ctx.fillRect(p.x + 26, p.y + 18, 10, 16);
    // legs
    ctx.fillStyle = "#2c3e50";
    const legPhase = p.onGround ? ((state.distance / 6) | 0) % 2 : 0;
    ctx.fillRect(p.x + 10, p.y + 40, 8, 8 + legPhase * 2);
    ctx.fillRect(p.x + 20, p.y + 40, 8, 8 + (1 - legPhase) * 2);
  }

  function drawObstacle(o) {
    ctx.fillStyle = o.color;
    if (o.key === "cone") {
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2, o.y);
      ctx.lineTo(o.x + o.w, o.y + o.h);
      ctx.lineTo(o.x, o.y + o.h);
      ctx.closePath();
      ctx.fill();
    } else if (o.key === "puddle") {
      ctx.beginPath();
      ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (o.key === "msg") {
      roundRect(o.x, o.y, o.w, o.h, 6);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(o.label, o.x + o.w / 2, o.y + o.h / 2 + 4);
      return;
    } else {
      roundRect(o.x, o.y, o.w, o.h, 4);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(o.label, o.x + o.w / 2, o.y - 4);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
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

  function onAction(e) {
    if (e.type === "keydown" && e.code !== "Space" && e.code !== "ArrowUp") return;
    if (e.type === "keydown") e.preventDefault();
    if (!state.running) {
      resetGame();
      return;
    }
    jump();
  }

  btnStart.addEventListener("click", (e) => {
    e.stopPropagation();
    resetGame();
  });

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!state.running) {
      resetGame();
      return;
    }
    jump();
  });

  window.addEventListener("keydown", onAction);

  // idle frame
  resetPlayer();
  state.obstacles = [];
  draw();
})();
