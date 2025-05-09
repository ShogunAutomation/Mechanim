import * as gameState from './gameState.js';
import { allCards, playerDeck, playerHand, playCard, initCards, loadDeck, saveDeck } from './cards.js';

export function setupUI() {
  console.log("Setting up UI");
  
  // Set up navigation buttons with direct function references
  document.getElementById("start-button").onclick = window.startGame;
  document.getElementById("deck-builder-button").onclick = openDeckBuilder;
  document.getElementById("restart-button").onclick = window.restartGame;
  document.getElementById("back-button").onclick = closeDeckBuilder;
  document.getElementById("save-deck-button").onclick = saveDeck;
  document.getElementById("tutorial-close").onclick = closeTutorial;
  
  // Set up card collection handlers
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
          if (window.gameRunning) {
            playCard(idx);
          }
        }
      }
    });
  }
  console.log("Click listeners attached for deck builder and battle contexts.");
}

export function handleDeckBuilderClick(cardEl) {
  const idx = parseInt(cardEl.dataset.cardIdx);
  if (isNaN(idx)) {
    console.error("Invalid card index in deck builder.");
    return;
  }
  
  console.log("Card clicked in deck builder:", idx, "From container:", cardEl.closest("#current-deck") ? "current-deck" : "collection");
  window.toggleDeck(idx, cardEl);
}

export function showTutorial() {
  eTutorial.style.display = "flex";
}

export function closeTutorial() {
  eTutorial.style.display = "none";
}

export function openDeckBuilder() {
  eMenu.style.display = "none";
  eDeckB.style.display = "flex";

  // Make sure cards are properly initialized
  initCards();
  loadDeck();
}

export function closeDeckBuilder() {
  console.log("close deck builder click function called");
  gameState.showScreen('menu');
}

export function updateUI() {
  // Use gameState to access values
  document.getElementById("energy-value").textContent = `${Math.floor(
    gameState.get('playerEnergy')
  )}/${gameState.getConfig('ENERGY_MAX')}`;
  document.getElementById("command-value").textContent = `${
    gameState.get('playerMechs')
  }/${gameState.getConfig('CMD_BASE')}`;
  document.getElementById("deck-count").textContent = `${playerDeck.length}`;

  // Render hand for battle
  const handEl = document.getElementById("card-hand");
  handEl.innerHTML = "";
  
  playerHand.forEach((cardIdx, i) => {
    const c = allCards[cardIdx];
    const d = document.createElement("div");
    d.className = "card";
    d.dataset.handIdx = i;
    
    d.innerHTML = `
      <span class="card-cost">${c.cost}</span>
      <span class="card-title">${c.name}</span>
    `;
    
    d.onmousedown = function() {
      console.log(`CARD MOUSEDOWN: ${i} - ${c.name}`);
      // Use gameState.get('gameRunning') instead of window.gameRunning
      if (gameState.get('gameRunning')) {
        console.log("Game is running, playing card...");
        playCard(i);
      } else {
        console.log("Game not running, can't play card");
      }
    };
    
    handEl.appendChild(d);
  });
}
