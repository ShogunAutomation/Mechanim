/**
 * Game State Manager
 * Centralizes all game state and provides safe accessors
 */

// Configuration constants
const CONFIG = {
  ENERGY_MAX: 10,
  ENERGY_RATE: 1,
  CMD_BASE: 5,
  CARD_DRAW_INTERVAL: 4,
  MAX_HAND: 5,
  SPAWN_CD: 3,
  CAPTURE_DIST: 80,
  CAPTURE_RATE: 0.2
};

// Game state
const state = {
  // Canvas and rendering
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  lastTimestamp: 0,
  
  // Game flow
  gameRunning: false,
  
  // Resources and counters
  playerEnergy: 0,
  playerMechs: 0,
  enemyEnergy: 0,
  enemyMechs: 0,
  drawTimer: 0,
  spawnCooldown: 0,
  enemySpawnCooldown: 0,
  
  // Game objects
  gameObjects: [],
  particles: [],
  
  // UI elements
  menuScreen: null,
  endScreen: null,
  deckBuilder: null,
  tutorialModal: null
};

// Initialize all UI references
export function initUI() {
  state.menuScreen = document.getElementById("menu-screen");
  state.endScreen = document.getElementById("end-screen");
  state.deckBuilder = document.getElementById("deck-builder");
  state.tutorialModal = document.getElementById("tutorial-modal");
  
  console.log("GameState UI initialized");
}

// Initialize canvas
export function initCanvas(canvasElement) {
  state.canvas = canvasElement;
  state.ctx = canvasElement.getContext("2d");
  updateCanvasSize();
  console.log("GameState canvas initialized");
}

// Update canvas dimensions
export function updateCanvasSize() {
  if (!state.canvas) {
    console.error("Canvas not initialized");
    return;
  }
  
  const rect = state.canvas.parentElement.getBoundingClientRect();
  state.canvas.width = rect.width;
  state.canvas.height = rect.height;
  state.width = rect.width;
  state.height = rect.height;
}

// Getters for config values
export function getConfig(key) {
  return CONFIG[key];
}

// State accessors
export function get(key) {
  return state[key];
}

// State mutators
export function set(key, value) {
  state[key] = value;
  return value;
}

// Special accessor for game objects array
export function getGameObjects() {
  // Initialize if not already
  if (!state.gameObjects) {
    state.gameObjects = [];
  }
  return state.gameObjects;
}

// Add/remove game objects
export function addGameObject(obj) {
  if (!state.gameObjects) {
    state.gameObjects = [];
  }
  state.gameObjects.push(obj);
  return obj;
}

export function removeGameObject(obj) {
  if (!state.gameObjects) return;
  
  const index = state.gameObjects.indexOf(obj);
  if (index !== -1) {
    state.gameObjects.splice(index, 1);
  }
}

export function filterGameObjects() {
  if (!state.gameObjects) return;
  state.gameObjects = state.gameObjects.filter(obj => !obj.remove);
}

// Particle management
export function addParticle(particle) {
  if (!state.particles) {
    state.particles = [];
  }
  state.particles.push(particle);
  return particle;
}

export function updateParticles(deltaTime) {
  if (!state.particles) {
    state.particles = [];
    return;
  }
  
  state.particles = state.particles.filter(particle => {
    const alive = particle.update(deltaTime);
    if (alive) particle.render();
    return alive;
  });
}

// Game progress updates
export function updateEnergy(deltaTime) {
  state.playerEnergy = Math.min(
    CONFIG.ENERGY_MAX, 
    state.playerEnergy + CONFIG.ENERGY_RATE * deltaTime
  );
  state.enemyEnergy = Math.min(
    CONFIG.ENERGY_MAX, 
    state.enemyEnergy + CONFIG.ENERGY_RATE * deltaTime
  );
}

export function updateCooldowns(deltaTime) {
  if (state.spawnCooldown > 0) state.spawnCooldown -= deltaTime;
  if (state.enemySpawnCooldown > 0) state.enemySpawnCooldown -= deltaTime;
}

export function resetGameState() {
  state.gameObjects = [];
  state.particles = [];
  state.playerEnergy = CONFIG.ENERGY_MAX;
  state.enemyEnergy = CONFIG.ENERGY_MAX;
  state.playerMechs = 0;
  state.enemyMechs = 0;
  state.drawTimer = 0;
  state.spawnCooldown = 0;
  state.enemySpawnCooldown = 0;
  state.gameRunning = true;
  console.log("Game state reset");
}

// UI state management
export function showScreen(screenKey) {
  console.log(`Showing screen: ${screenKey}`);
  
  if (screenKey === 'menu') {
    state.menuScreen.style.display = 'flex';
    state.endScreen.style.display = 'none';
    state.deckBuilder.style.display = 'none';
  } 
  else if (screenKey === 'end') {
    state.menuScreen.style.display = 'none';
    state.endScreen.style.display = 'flex';
    state.deckBuilder.style.display = 'none';
  }
  else if (screenKey === 'deckBuilder') {
    state.menuScreen.style.display = 'none';
    state.endScreen.style.display = 'none';
    state.deckBuilder.style.display = 'flex';
  } 
  else if (screenKey === 'game') {
    state.menuScreen.style.display = 'none';
    state.endScreen.style.display = 'none';
    state.deckBuilder.style.display = 'none';
  }
}

export function showTutorial(show = true) {
  state.tutorialModal.style.display = show ? 'flex' : 'none';
  console.log(`Tutorial ${show ? 'shown' : 'hidden'}`);
}
