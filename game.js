// ==== constants & state ====
const ENERGY_MAX = 10,
  ENERGY_RATE = 1,
  CMD_BASE = 5;
const CARD_DRAW_INTERVAL = 4,
  MAX_HAND = 5;
const SPAWN_CD = 3,
  CAPTURE_DIST = 80,
  CAPTURE_RATE = 0.2;
let canvas,
  ctx,
  w,
  h,
  lastTS = 0;
let gameRunning = false;

let pe = 0,
  pm = 0,
  ee = 0,
  em = 0;
let drawTimer = 0,
  scd = 0,
  escd = 0;

let gameObjects = [],
  particles = [];
let allCards = [],
  playerDeck = [],
  playerHand = [],
  aiHand = [];

// UI elements
const eMenu = document.getElementById("menu-screen");
const eEnd = document.getElementById("end-screen");
const eDeckB = document.getElementById("deck-builder");
const eTutorial = document.getElementById("tutorial-modal");

// ==== setup ====
window.onload = () => {
  canvas = document.getElementById("game-canvas");
  ctx = canvas.getContext("2d");
  resize();
  window.onresize = resize;

  setupUI();
  initCards();
  loadDeck();

  if (!localStorage.tutorialShown) {
    showTutorial();
    localStorage.tutorialShown = "1";
  }

  // Add this line to enable click debugging
  debugCardClicks();

  // Additional diagnostics for card elements
  setTimeout(function() {
    const cards = document.querySelectorAll('.card');
    console.log(`Found ${cards.length} card elements`);
    
    cards.forEach((card, i) => {
      console.log(`Card ${i} is clickable:`, getComputedStyle(card).pointerEvents !== 'none');
      // Add a direct test click handler
      card.setAttribute('onclick', 'console.log("Inline card click ' + i + '")');
    });
    
    // Test event bubbling
    document.getElementById("card-hand").addEventListener('click', function(e) {
      console.log("Card hand clicked:", e.target);
    }, true); // Use capture phase
  }, 1000); // Wait for everything to be ready
};

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  w = rect.width;
  h = rect.height;
}

function setupUI() {
  document.getElementById("start-button").onclick = startGame;
  document.getElementById("deck-builder-button").onclick = openDeckBuilder;
  document.getElementById("restart-button").onclick = restartGame;
  document.getElementById("back-button").onclick = closeDeckBuilder;
  document.getElementById("save-deck-button").onclick = saveDeck;
  document.getElementById("tutorial-close").onclick = closeTutorial;

  const cardCollection = document.getElementById("card-collection");
  if (cardCollection) {
    cardCollection.addEventListener("click", (evt) => {
      const cardEl = evt.target.closest(".collection-card");
      if (cardEl) handleDeckBuilderClick(cardEl);
    });
  }

  const currentDeck = document.getElementById("current-deck");
  if (currentDeck) {
    currentDeck.addEventListener("click", (evt) => {
      const cardEl = evt.target.closest(".collection-card");
      if (cardEl) handleDeckBuilderClick(cardEl);
    });
  }

  const cardHand = document.getElementById("card-hand");
  if (cardHand) {
    cardHand.addEventListener("click", function(evt) {
      console.log("Card hand received click event", evt.target);
      const cardEl = evt.target.closest(".card");
      if (cardEl) {
        const idx = parseInt(cardEl.dataset.handIdx);
        if (!isNaN(idx)) {
          console.log(`Card detected via delegation: ${idx}`);
          if (gameRunning) {
            playCard(idx);
          }
        }
      }
    });
    console.log("Card hand click listener re-attached with proper delegation.");
  }
  console.log("Click listeners attached for deck builder and battle contexts.");
}

function handleDeckBuilderClick(cardEl) {
  const idx = parseInt(cardEl.dataset.cardIdx);
  if (isNaN(idx)) {
    console.error("Invalid card index in deck builder.");
    return;
  }
  toggleDeck(idx, cardEl);
}

function handleBattleClick(cardEl) {
  console.log("Card clicked:", cardEl); // Debug the actual element
  
  if (!gameRunning) {
    console.warn("Game is not running. Ignoring card click.");
    return;
  }
  
  const idx = parseInt(cardEl.dataset.handIdx);
  console.log("Card index:", idx, "data attribute:", cardEl.dataset.handIdx); // Debug index extraction
  
  if (isNaN(idx)) {
    console.error("Invalid card index in battle.");
    return;
  }
  
  const card = allCards[playerHand[idx]];
  console.log(`Card clicked in battle: Hand Index = ${idx}, Card =`, card);
  playCard(idx);
}

function showTutorial() {
  eTutorial.style.display = "flex";
}
function closeTutorial() {
  eTutorial.style.display = "none";
}

function openDeckBuilder() {
  eMenu.style.display = "none";
  eDeckB.style.display = "flex";
  // Make sure cards are properly initialized
  initCards();
  loadDeck();
}

function closeDeckBuilder() {
  eDeckB.style.display = "none";
  eMenu.style.display = "flex";
}

// ==== Card System ====
function initCards() {
  allCards = [
    {
      name: "Basic Mech",
      type: "unit",
      cost: 2,
      unit: "basic",
      desc: "Spawn a basic mech with balanced stats.",
      icon: "🤖"
    },
    {
      name: "Tank Mech",
      type: "unit",
      cost: 4,
      unit: "tank",
      desc: "Spawn a heavy tank with high health and damage.",
      icon: "🛡️"
    },
    {
      name: "Heal Spell",
      type: "spell",
      cost: 3,
      effect: (target) => {
        target.health = Math.min(target.health + 30, target.maxHealth);
      },
      desc: "Heal 30 HP to nearest friendly unit.",
      icon: "✨"
    },
    {
      name: "Turret",
      type: "structure",
      cost: 5,
      desc: "Place a turret spawn point to defend your base.",
      icon: "🔫"
    }
  ];

  const collection = document.getElementById("card-collection");
  collection.innerHTML = ''; // Clear existing cards

  allCards.forEach((card, idx) => {
    const el = document.createElement("div");
    el.className = "collection-card";
    el.innerHTML = `
      <div class="card-cost">${card.cost}</div>
      <div class="card-type">${card.type}</div>
      <div class="card-icon">${card.icon || ''}</div>
      <div class="card-title">${card.name}</div>
      <div class="card-desc">${card.desc}</div>
    `;
    el.onclick = () => toggleDeck(idx, el);
    collection.appendChild(el);
  });

  updateCurrentDeckDisplay();
}

function toggleDeck(idx, el) {
  if (playerDeck.length < 20) {
    playerDeck.push(idx); // Allow duplicates by simply adding the index
    el.classList.add("selected");
  }
  document.getElementById("deck-card-count").textContent = playerDeck.length;
  updateCurrentDeckDisplay();
}

function saveDeck() {
  if (playerDeck.length === 0) {
    alert("Your deck is empty! Please add some cards before saving.");
    return;
  }

  localStorage.playerDeck = JSON.stringify(playerDeck);
  closeDeckBuilder();
}

function loadDeck() {
  if (localStorage.playerDeck) {
    playerDeck = JSON.parse(localStorage.playerDeck);
    document.querySelectorAll(".collection-card").forEach((el, idx) => {
      if (playerDeck.includes(idx)) el.classList.add("selected");
    });
  } else {
    // default deck
    playerDeck = [0, 0, 1, 1, 2, 2, 3];
  }
  document.getElementById("deck-card-count").textContent = playerDeck.length;
  updateCurrentDeckDisplay();
}

function updateCurrentDeckDisplay() {
  const currentDeckEl = document.getElementById("current-deck");
  currentDeckEl.innerHTML = '';

  // Create a count of each card in the deck
  const cardCounts = {};
  playerDeck.forEach(idx => {
    cardCounts[idx] = (cardCounts[idx] || 0) + 1;
  });

  // Display each unique card with count
  Object.keys(cardCounts).forEach(idx => {
    const card = allCards[idx];
    const count = cardCounts[idx];

    const el = document.createElement("div");
    el.className = "collection-card";
    el.innerHTML = `
      <div class="card-cost">${card.cost}</div>
      <div class="card-type">${card.type}</div>
      <div class="card-icon">${card.icon || ''}</div>
      <div class="card-title">${card.name} x${count}</div>
      <div class="card-desc">${card.desc}</div>
    `;
    currentDeckEl.appendChild(el);
  });

  // If deck is empty, show a message
  if (playerDeck.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.style.width = "100%";
    emptyMsg.style.textAlign = "center";
    emptyMsg.style.padding = "40px 0";
    emptyMsg.style.color = "#aaa";
    emptyMsg.textContent = "Your deck is empty. Click cards from the collection to add them.";
    currentDeckEl.appendChild(emptyMsg);
  }
}

// ==== Game Objects & Logic ====
class GameObject {
  constructor(x, y, w, h, type, faction) {
    Object.assign(this, {
      x,
      y,
      w,
      h,
      type,
      faction,
      health: 100,
      maxHealth: 100,
      damage: 10,
      range: 100,
      cooldown: 0,
      aspd: 1,
      speed: 0,
      target: null,
      remove: false,
    });
  }
  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (!this.target || this.target.remove) this.acquireTarget();
    if (this.target) {
      const dx = this.target.x - this.x,
        dy = this.target.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= this.range) {
        if (this.cooldown <= 0) {
          this.target.takeDamage(this.damage);
          this.cooldown = 1 / this.aspd;
          this.spawnEffect(this.target);
        }
      } else if (this.speed > 0) {
        this.x += (dx / dist) * this.speed * dt;
        this.y += (dy / dist) * this.speed * dt;
      }
    }
  }
  acquireTarget() {
    let minD = Infinity,
      best = null;
    gameObjects.forEach((o) => {
      if (o.faction === this.faction || o.remove) return;
      let d = Math.hypot(o.x - this.x, o.y - this.y);
      if (o.type === "hq") d *= 0.5;
      if (d < minD) {
        minD = d;
        best = o;
      }
    });
    this.target = best;
  }
  spawnEffect(tgt) {
    particles.push(
      new Particle(
        this.x + this.w / 2,
        this.y + this.h / 2,
        tgt.x + tgt.w / 2,
        tgt.y + tgt.h / 2,
        this.faction === "player" ? "#60f0ff" : "#ff6060"
      )
    );
  }
  takeDamage(amount) {
    this.health -= amount;
    this.showDamage(amount);
    if (this.health <= 0) {
      this.remove = true;
      if (this.type !== "hq" && this.type !== "obelisk") {
        if (this.faction === "player") pm--;
        else em--;
      }
      if (this.type === "hq") endGame(this.faction !== "player");
    }
  }
  showDamage(amount) {
    const et = document.createElement("div");
    et.className = "effect-text";
    et.textContent = `-${amount}`;
    et.style.left = `${this.x + this.w / 2}px`;
    et.style.top = `${this.y}px`;
    document.getElementById("battlefield").appendChild(et);
    setTimeout(() => et.remove(), 1500);
  }
  render() {
    // body
    ctx.fillStyle = this.faction === "player" ? "#4080ff" : "#ff4040";
    ctx.fillRect(this.x, this.y, this.w, this.h);
    // health bar
    const pct = this.health / this.maxHealth;
    ctx.fillStyle = "#333";
    ctx.fillRect(this.x, this.y + this.h + 2, this.w, 4);
    ctx.fillStyle = pct > 0.6 ? "#2f2" : pct > 0.3 ? "#ff2" : "#f22";
    ctx.fillRect(this.x, this.y + this.h + 2, this.w * pct, 4);
  }
}

class Headquarters extends GameObject {
  constructor(x, y, f) {
    super(x, y, 80, 80, "hq", f);
    this.health = this.maxHealth = 500;
    this.range = 200;
    this.damage = 15;
    this.aspd = 0.5;
    this.spawnPoint = { x: x + (f === "player" ? 100 : -60), y: y + 40 };
  }
  update(dt) {
    super.update(dt);
    if (this.faction === "player" && scd <= 0) {
      this.spawnUnit();
      scd = SPAWN_CD;
    }
    if (this.faction === "enemy" && escd <= 0) {
      this.spawnUnit();
      escd = SPAWN_CD;
    }
  }
  spawnUnit() {
    const u = new Mech(
      this.spawnPoint.x,
      this.spawnPoint.y,
      "basic",
      this.faction
    );
    gameObjects.push(u);
    if (this.faction === "player") pm++;
    else em++;
    particles.push(
      new Particle(
        this.spawnPoint.x,
        this.spawnPoint.y,
        this.spawnPoint.x,
        this.spawnPoint.y,
        this.faction === "player" ? "#60f0ff" : "#ff6060",
        0.4
      )
    );
  }
  render() {
    // gradient body
    const grad = ctx.createRadialGradient(
      this.x + 40,
      this.y + 40,
      10,
      this.x + 40,
      this.y + 40,
      50
    );
    grad.addColorStop(0, this.faction === "player" ? "#80c0ff" : "#ff8080");
    grad.addColorStop(1, this.faction === "player" ? "#2040a0" : "#a02020");
    ctx.fillStyle = grad;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    // border
    ctx.strokeStyle = this.faction === "player" ? "#60f0ff" : "#ff6060";
    ctx.lineWidth = 3;
    ctx.strokeRect(this.x, this.y, this.w, this.h);
    // health bar
    const pct = this.health / this.maxHealth;
    ctx.fillStyle = "#333";
    ctx.fillRect(this.x, this.y + 82, this.w, 6);
    ctx.fillStyle = pct > 0.6 ? "#2f2" : pct > 0.3 ? "#ff2" : "#f22";
    ctx.fillRect(this.x, this.y + 82, this.w * pct, 6);
  }
}

class Mech extends GameObject {
  constructor(x, y, subtype, f) {
    super(x, y, 40, 40, "unit", f);
    this.subtype = subtype;
    switch (subtype) {
      case "basic":
        this.health = 80;
        this.maxHealth = 80;
        this.damage = 15;
        this.range = 150;
        this.speed = 60;
        this.aspd = 0.8;
        break;
      case "tank":
        this.health = 200;
        this.maxHealth = 200;
        this.damage = 30;
        this.range = 120;
        this.speed = 40;
        this.aspd = 0.5;
        break;
    }
  }
  render() {
    ctx.fillStyle = this.faction === "player" ? "#4080ff" : "#ff4040";
    ctx.fillRect(this.x, this.y, this.w, this.h);
    const pct = this.health / this.maxHealth;
    ctx.fillStyle = "#333";
    ctx.fillRect(this.x, this.y + 42, this.w, 4);
    ctx.fillStyle = pct > 0.6 ? "#2f2" : pct > 0.3 ? "#ff2" : "#f22";
    ctx.fillRect(this.x, this.y + 42, this.w * pct, 4);
  }
}

class Obelisk extends GameObject {
  constructor(x, y) {
    super(x, y, 50, 50, "obelisk", "neutral");
    this.capture = 0; // -1..1
  }
  update(dt) {
    super.update(dt);
    ["player", "enemy"].forEach((f) => {
      const inRange = gameObjects.some(
        (o) =>
          o.faction === f &&
          Math.hypot(o.x - this.x, o.y - this.y) < CAPTURE_DIST
      );
      if (inRange) {
        this.capture += (f === "player" ? CAPTURE_RATE : -CAPTURE_RATE) * dt;
        this.capture = Math.max(-1, Math.min(1, this.capture));
      }
    });
    if (Math.abs(this.capture) >= 1 && this.faction === "neutral") {
      this.faction = this.capture > 0 ? "player" : "enemy";
      if (this.faction === "player") pm++;
      else em++;
    }
  }
  render() {
    ctx.fillStyle =
      this.faction === "neutral"
        ? "#888"
        : this.faction === "player"
          ? "#60f0ff"
          : "#ff6060";
    ctx.fillRect(this.x, this.y, this.w, this.h);
    // progress bar
    ctx.fillStyle = "#333";
    ctx.fillRect(this.x, this.y + 52, this.w, 4);
    const wProg = ((this.capture + 1) / 2) * this.w;
    ctx.fillStyle = this.capture > 0 ? "#2f2" : "#f22";
    ctx.fillRect(this.x, this.y + 52, wProg, 4);
  }
}

class Particle {
  constructor(x1, y1, x2, y2, color, dur = 0.2) {
    Object.assign(this, { x1, y1, x2, y2, color, time: 0, dur });
  }
  update(dt) {
    this.time += dt;
    return this.time < this.dur;
  }
  render() {
    const t = this.time / this.dur;
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(
      this.x1 + (this.x2 - this.x1) * t,
      this.y1 + (this.y2 - this.y1) * t
    );
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ==== Game Loop & Flow ====
function startGame() {
  eMenu.style.display = "none";
  resetGame();
  gameRunning = true;
  lastTS = 0;
  requestAnimationFrame(tick);
}

function resetGame() {
  gameObjects = [];
  particles = [];
  pe = ENERGY_MAX;
  ee = ENERGY_MAX;
  pm = 0;
  em = 0;
  drawTimer = scd = escd = 0;

  // spawn HQs
  gameObjects.push(new Headquarters(100, h / 2 - 40, "player"));
  gameObjects.push(new Headquarters(w - 180, h / 2 - 40, "enemy"));

  // spawn obelisks
  [
    [w / 2 - 50, h / 3],
    [w / 3, h / 2 + 100],
    [(2 * w) / 3, h / 2 + 100],
  ].forEach(([x, y]) => gameObjects.push(new Obelisk(x, y)));

  // initial hands
  playerHand = [];
  aiHand = [];
  for (let i = 0; i < 3; i++) {
    drawCard("player");
    drawCard("enemy");
  }
}

function restartGame() {
  eEnd.style.display = "none";
  startGame();
}

function tick(ts) {
  if (!gameRunning) return;
  const dt = lastTS ? (ts - lastTS) / 1000 : 0;
  lastTS = ts;

  update(dt);
  render();

  requestAnimationFrame(tick);
}

function update(dt) {
  // regen energy
  pe = Math.min(ENERGY_MAX, pe + ENERGY_RATE * dt);
  ee = Math.min(ENERGY_MAX, ee + ENERGY_RATE * dt);

  // spawn cooldowns
  if (scd > 0) scd -= dt;
  if (escd > 0) escd -= dt;

  // card draw timing
  drawTimer += dt;
  if (drawTimer >= CARD_DRAW_INTERVAL) {
    drawCard("player");
    drawCard("enemy");
    drawTimer = 0;
    aiPlay();
  }

  // update game objects
  gameObjects.forEach((o) => o.update(dt));
  gameObjects = gameObjects.filter((o) => !o.remove);

  // update particles
  particles = particles.filter((p) => {
    const alive = p.update(dt);
    if (alive) p.render();
    return alive;
  });

  updateUI();
}

function render() {
  ctx.clearRect(0, 0, w, h);
  gameObjects.forEach((o) => o.render());
  // particles are rendered during update for smooth timing
}

// Simplify the updateUI function to use direct onclick handlers
function updateUI() {
  document.getElementById("energy-value").textContent = `${Math.floor(
    pe
  )}/${ENERGY_MAX}`;
  document.getElementById("command-value").textContent = `${pm}/${CMD_BASE}`;
  document.getElementById("deck-count").textContent = `${playerDeck.length}`;

  // Render hand for battle - COMPLETELY REVISED APPROACH
  const handEl = document.getElementById("card-hand");
  handEl.innerHTML = "";
  
  playerHand.forEach((cardIdx, i) => {
    const c = allCards[cardIdx];
    const d = document.createElement("div");
    d.className = "card";
    d.dataset.handIdx = i;
    
    // SIMPLIFIED CARD CONTENT
    d.innerHTML = `
      <span class="card-cost">${c.cost}</span>
      <span class="card-title">${c.name}</span>
    `;
    
    // Multiple event types to ensure something catches
    d.onclick = function() {
      console.log(`CARD CLICKED: ${i} - ${c.name}`);
      if (gameRunning) playCard(i);
      return false; // Prevent default and stop propagation
    };
    
    d.onmousedown = function() {
      console.log(`CARD MOUSEDOWN: ${i} - ${c.name}`);
      playCard(i);
    };
    
    handEl.appendChild(d);
  });

  // Render current deck for deck builder
  const currentDeckEl = document.getElementById("current-deck");
  currentDeckEl.innerHTML = "";
  const cardCounts = {};
  playerDeck.forEach((idx) => {
    cardCounts[idx] = (cardCounts[idx] || 0) + 1;
  });
  Object.keys(cardCounts).forEach((idx) => {
    const card = allCards[idx];
    const count = cardCounts[idx];
    const el = document.createElement("div");
    el.className = "collection-card";
    el.dataset.cardIdx = idx;
    el.innerHTML = `
      <div class="card-cost">${card.cost}</div>
      <div class="card-type">${card.type}</div>
      <div class="card-title">${card.name} x${count}</div>
      <div class="card-desc">${card.desc}</div>
    `;
    currentDeckEl.appendChild(el);
  });
}

// Remove or simplify the global diagnostic listener since we're using direct onclick
document.addEventListener("DOMContentLoaded", function() {
  const handArea = document.querySelector("#hand-area");
  if (handArea) {
    handArea.addEventListener("click", function(e) {
      // Only log if clicked directly on hand area (not on a card)
      if (e.target === handArea || e.target === document.getElementById("card-hand")) {
        console.log("Click in hand area background");
      }
    });
  }
});

function drawCard(who) {
  if (who === "player" && playerHand.length < MAX_HAND) {
    playerHand.push(playerDeck[Math.floor(Math.random() * playerDeck.length)]);
  }
  if (who === "enemy" && aiHand.length < MAX_HAND) {
    aiHand.push(playerDeck[Math.floor(Math.random() * playerDeck.length)]);
  }
}

function playCard(handIdx) {
  const idx = playerHand[handIdx];
  const card = allCards[idx];
  if (pe < card.cost) {
    console.log(`Not enough energy to play card: ${card.name} (Cost: ${card.cost}, Energy: ${pe})`);
    return;
  }
  pe -= card.cost;
  playerHand.splice(handIdx, 1);
  console.log(`Card played: ${card.name} (Type: ${card.type}, Cost: ${card.cost})`);

  if (card.type === "unit") {
    const m = new Mech(150, h - 200, card.unit, "player");
    gameObjects.push(m);
    pm++;
  } else if (card.type === "spell") {
    // find nearest friendly
    const friendlies = gameObjects.filter(
      (o) => o.faction === "player" && o.type !== "hq"
    );
    if (friendlies.length > 0) {
      friendlies.sort((a, b) => a.health - b.health);
      console.log(`Spell effect applied to: ${friendlies[0].type} (Health: ${friendlies[0].health})`);
      card.effect(friendlies[0]);
    }
  } else if (card.type === "structure") {
    // place a turret spawn point
    gameObjects.push(new Headquarters(w / 2 - 40, h - 100, "player"));
    console.log(`Structure placed: ${card.name}`);
  }
}

function aiPlay() {
  for (let i = 0; i < aiHand.length; i++) {
    const idx = aiHand[i],
      c = allCards[idx];
    if (ee >= c.cost) {
      ee -= c.cost;
      aiHand.splice(i, 1);
      if (c.type === "unit") {
        const m = new Mech(w - 150, 200, c.unit, "enemy");
        gameObjects.push(m);
        em++;
      }
      break;
    }
  }
}

function endGame(playerLost) {
  gameRunning = false;
  document.getElementById("end-message").textContent = playerLost
    ? "DEFEAT"
    : "VICTORY";
  eEnd.style.display = "flex";
}

// Add a simple diagnostic function to help identify click issues
function debugCardClicks() {
  document.addEventListener("click", function(e) {
    console.log("Document click on:", e.target);
    console.log("Closest card:", e.target.closest(".card"));
    console.log("Event path:", e.composedPath().map(el => el.tagName || el.id || el.className).join(' > '));
  }, true); // Use capture phase to see all clicks
}
