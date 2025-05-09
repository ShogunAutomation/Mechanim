import { initCards, loadDeck, playerDeck, playerHand, aiHand, allCards, drawCard, playCard, toggleDeck, saveDeck } from './modules/cards.js';
import { GameObject, Headquarters, Mech, Obelisk, Particle } from './modules/gameObjects.js';
import { setupUI, updateUI, showTutorial, closeTutorial, openDeckBuilder, closeDeckBuilder } from './modules/ui.js';
import * as gameState from './modules/gameState.js';
import { debugCardClicks } from './modules/utils.js';

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

// UI elements
const eMenu = document.getElementById("menu-screen");
const eEnd = document.getElementById("end-screen");
const eDeckB = document.getElementById("deck-builder");
const eTutorial = document.getElementById("tutorial-modal");

// Export game state for other modules
export {
  ENERGY_MAX, ENERGY_RATE, CMD_BASE, CARD_DRAW_INTERVAL, MAX_HAND,
  SPAWN_CD, CAPTURE_DIST, CAPTURE_RATE,
  canvas, ctx, w, h, gameRunning,
  pe, pm, ee, em, drawTimer, scd, escd,
  gameObjects, particles,
  eMenu, eEnd, eDeckB, eTutorial
};

// ==== setup ====
window.onload = () => {
  canvas = document.getElementById("game-canvas");
  
  // Initialize game state
  gameState.initUI();
  gameState.initCanvas(canvas);
  
  window.onresize = gameState.updateCanvasSize;

  // Make sure toggleDeck is properly defined
  if (typeof toggleDeck !== 'function') {
    console.error('toggleDeck function not imported correctly');
  }

  // Expose necessary functions to window object for HTML access
  window.startGame = startGame;
  window.restartGame = restartGame;
  window.openDeckBuilder = openDeckBuilder;
  window.closeDeckBuilder = closeDeckBuilder;
  window.toggleDeck = toggleDeck;
  window.saveDeck = saveDeck;
  window.showTutorial = showTutorial;
  window.closeTutorial = closeTutorial;
  
  setupUI();
  initCards();
  loadDeck();

  if (!localStorage.tutorialShown) {
    gameState.showTutorial(true);
    localStorage.tutorialShown = "1";
  }

  // Add debug click tracking
  debugCardClicks();
};

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  w = rect.width;
  h = rect.height;
}

// ==== Game Loop & Flow ====
function startGame() {
  gameState.showScreen('game'); // Hide all overlay screens
  resetGame();
  gameState.set('gameRunning', true);
  gameState.set('lastTimestamp', 0);
  requestAnimationFrame(tick);
}

function resetGame() {
  // Reset the game state
  gameState.resetGameState();

  // Spawn HQs
  const h = gameState.get('height');
  const w = gameState.get('width');
  
  gameState.addGameObject(new Headquarters(100, h / 2 - 40, "player"));
  gameState.addGameObject(new Headquarters(w - 180, h / 2 - 40, "enemy"));

  // Spawn obelisks
  [
    [w / 2 - 50, h / 3],
    [w / 3, h / 2 + 100],
    [(2 * w) / 3, h / 2 + 100],
  ].forEach(([x, y]) => gameState.addGameObject(new Obelisk(x, y)));

  // Initial hands
  playerHand.length = 0;
  aiHand.length = 0;
  for (let i = 0; i < 3; i++) {
    drawCard("player");
    drawCard("enemy");
  }
}

function restartGame() {
  gameState.showScreen('game');
  startGame();
}

function tick(ts) {
  if (!gameState.get('gameRunning')) return;
  
  const lastTS = gameState.get('lastTimestamp');
  const dt = lastTS ? (ts - lastTS) / 1000 : 0;
  gameState.set('lastTimestamp', ts);

  update(dt);
  render();

  requestAnimationFrame(tick);
}

function update(dt) {
  // Update energy and cooldowns
  gameState.updateEnergy(dt);
  gameState.updateCooldowns(dt);

  // Card draw timing
  let drawTimer = gameState.get('drawTimer') + dt;
  gameState.set('drawTimer', drawTimer);
  
  if (drawTimer >= gameState.getConfig('CARD_DRAW_INTERVAL')) {
    drawCard("player");
    drawCard("enemy");
    gameState.set('drawTimer', 0);
    aiPlay();
  }

  // Update game objects
  const gameObjects = gameState.getGameObjects();
  gameObjects.forEach((o) => o.update(dt));
  gameState.filterGameObjects();

  // Update particles
  gameState.updateParticles(dt);

  // Update UI
  updateUI();
}

function render() {
  const ctx = gameState.get('ctx');
  const w = gameState.get('width');
  const h = gameState.get('height');
  
  ctx.clearRect(0, 0, w, h);
  gameState.getGameObjects().forEach((o) => o.render());
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

// Expose functions to window for event handlers
window.startGame = startGame;
window.restartGame = restartGame;
window.openDeckBuilder = openDeckBuilder;
window.closeDeckBuilder = closeDeckBuilder;
