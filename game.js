import { initCards, loadDeck, playerDeck, playerHand, aiHand, allCards, drawCard, playCard, toggleDeck, saveDeck } from './modules/cards.js';
import { EMPEffect, ShieldGenerator, Headquarters, Turret, Obelisk, Particle, MechFactory } from './modules/gameObjects.js';
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
    aiPlay(); // Make sure AI play is called here
  }

  // Tag units for visual effects
  gameState.tagUnitsForVisuals();

  // Update game objects
  const gameObjects = gameState.getGameObjects();
  gameObjects.forEach((o) => o.update(dt));
  gameState.filterGameObjects();

  // Update particles for attacks and effects
  const particles = gameState.get('particles'); // Correct accessor for particles
  for (let i = particles.length - 1; i >= 0; i--) {
    if (!particles[i].update(dt)) {
      particles.splice(i, 1); // Remove expired particles
    }
  }

  // Update UI
  updateUI();
}

function render() {
  const ctx = gameState.get('ctx');
  const w = gameState.get('width');
  const h = gameState.get('height');
  
  ctx.clearRect(0, 0, w, h);
  gameState.getGameObjects().forEach((o) => o.render());
  
  // Render particles for visual effects
  gameState.get('particles').forEach((p) => p.render()); // Correct accessor for particles
}

function aiPlay() {
  // Get the current enemy energy from gameState
  const enemyEnergy = gameState.get('enemyEnergy');
  const width = gameState.get('width');
  const height = gameState.get('height');
  
  for (let i = 0; i < aiHand.length; i++) {
    const idx = aiHand[i];
    const card = allCards[idx];
    
    if (enemyEnergy >= card.cost) {
      // Deduct enemy energy
      gameState.set('enemyEnergy', enemyEnergy - card.cost);
      
      // Remove card from AI hand
      aiHand.splice(i, 1);
      
      // Play the card based on its type
      if (card.type === "unit") {
        // Use MechFactory to create the enemy unit
        const mech = MechFactory.createMech(
          width - 150, 
          Math.random() * (height - 300) + 150, // Random y position
          card.unit, 
          "enemy"
        );
        gameState.addGameObject(mech);
        gameState.set('enemyMechs', gameState.get('enemyMechs') + 1);
        console.log(`AI played unit: ${card.name}`);
      } 
      else if (card.type === "structure") {
        // Handle different structure types
        if (card.name === "Turret") {
          // Place enemy turret
          gameState.addGameObject(new Turret(
            width - 200, 
            Math.random() * (height - 300) + 150,  // Random y position
            "enemy"
          ));
          console.log(`AI placed turret`);
        }
        else if (card.name === "Shield Generator") {
          // Place enemy shield generator
          gameState.addGameObject(new ShieldGenerator(
            width - 200,
            Math.random() * (height - 300) + 150, // Random y position
            "enemy"
          ));
          console.log(`AI placed shield generator`);
        }
      }
      else if (card.type === "spell") {
        // Handle different spell types
        if (card.name === "Heal Spell") {
          // Heal the most damaged enemy unit
          const enemies = gameState.getGameObjects().filter(
            (o) => o.faction === "enemy" && o.type !== "hq" && o.health < o.maxHealth
          );
          
          if (enemies.length > 0) {
            // Sort by health percentage (lowest first)
            enemies.sort((a, b) => (a.health/a.maxHealth) - (b.health/b.maxHealth));
            const target = enemies[0];
            target.health = Math.min(target.health + 30, target.maxHealth);
            
            // Add healing visual effect
            gameState.addParticle(
              new Particle(
                target.x + target.w/2, 
                target.y + target.h/2,
                target.x + target.w/2, 
                target.y - 20,
                "#ff6060", // Enemy healing color
                1.0
              )
            );
            console.log(`AI used heal spell on ${target.type}`);
          }
        }
        else if (card.name === "EMP Blast") {
          // AI uses EMP near player units
          const playerUnits = gameState.getGameObjects().filter(
            (o) => o.faction === "player" && o.type === "unit"
          );
          
          if (playerUnits.length > 0) {
            // Find center of player units concentration
            let centerX = 0, centerY = 0;
            playerUnits.forEach(unit => {
              centerX += unit.x + unit.w/2;
              centerY += unit.y + unit.h/2;
            });
            centerX /= playerUnits.length;
            centerY /= playerUnits.length;
            
            // Create EMP effect and apply stun
            const empRadius = 150;
            gameState.addParticle(new EMPEffect(centerX, centerY, empRadius));
            
            // Apply stun to players in range
            playerUnits.forEach(unit => {
              if (Math.hypot(unit.x + unit.w/2 - centerX, unit.y + unit.h/2 - centerY) <= empRadius) {
                unit.stunned = true;
                unit.stunnedTime = 3; // Stun for 3 seconds
                
                // Add visual stun effect
                const el = document.createElement("div");
                el.textContent = "⚡";
                el.style.position = "absolute";
                el.style.left = `${unit.x + unit.w/2}px`;
                el.style.top = `${unit.y - 20}px`;
                el.style.color = "#ffff00";
                el.style.fontSize = "20px";
                el.style.zIndex = "10";
                el.style.pointerEvents = "none";
                el.style.animation = "float-up 3s forwards";
                document.getElementById("battlefield").appendChild(el);
                setTimeout(() => el.remove(), 3000);
              }
            });
            console.log(`AI used EMP Blast on player units`);
          }
        }
      }
      
      break; // Only play one card per turn
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
