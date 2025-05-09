import * as gameState from './gameState.js';
import { Mech, Headquarters } from './gameObjects.js';

// Card definitions and state
let allCards = [];
let playerDeck = [];
let playerHand = [];
let aiHand = [];

// Export card state
export { allCards, playerDeck, playerHand, aiHand };

export function initCards() {
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

// Make sure toggleDeck is properly exported
export function toggleDeck(idx, el) {
  if (playerDeck.length < 20) {
    playerDeck.push(idx); // Allow duplicates by simply adding the index
    el.classList.add("selected");
  }
  document.getElementById("deck-card-count").textContent = playerDeck.length;
  updateCurrentDeckDisplay();
}

export function saveDeck() {
  if (playerDeck.length === 0) {
    alert("Your deck is empty! Please add some cards before saving.");
    return;
  }

  localStorage.playerDeck = JSON.stringify(playerDeck);
  // Use window.closeDeckBuilder since we can't import circular dependencies
  window.closeDeckBuilder();
}

export function loadDeck() {
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

export function updateCurrentDeckDisplay() {
  const currentDeckEl = document.getElementById("current-deck");
  if (!currentDeckEl) return;
  
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
    el.dataset.cardIdx = idx;
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

export function drawCard(who) {
  if (who === "player" && playerHand.length < 5) {
    playerHand.push(playerDeck[Math.floor(Math.random() * playerDeck.length)]);
  }
  if (who === "enemy" && aiHand.length < 5) {
    aiHand.push(playerDeck[Math.floor(Math.random() * playerDeck.length)]);
  }
}

export function playCard(handIdx) {
  const idx = playerHand[handIdx];
  const card = allCards[idx];
  
  const playerEnergy = gameState.get('playerEnergy');
  
  if (playerEnergy < card.cost) {
    console.log(`Not enough energy to play card: ${card.name} (Cost: ${card.cost}, Energy: ${playerEnergy})`);
    return;
  }
  
  // Use state manager to update energy
  gameState.set('playerEnergy', playerEnergy - card.cost);
  playerHand.splice(handIdx, 1);
  console.log(`Card played: ${card.name} (Type: ${card.type}, Cost: ${card.cost})`);

  if (card.type === "unit") {
    const h = gameState.get('height');
    const m = new Mech(150, h - 200, card.unit, "player");
    gameState.addGameObject(m);
    gameState.set('playerMechs', gameState.get('playerMechs') + 1);
  } else if (card.type === "spell") {
    // Find nearest friendly
    const friendlies = gameState.getGameObjects().filter(
      (o) => o.faction === "player" && o.type !== "hq"
    );
    if (friendlies.length > 0) {
      friendlies.sort((a, b) => a.health - b.health);
      console.log(`Spell effect applied to: ${friendlies[0].type} (Health: ${friendlies[0].health})`);
      card.effect(friendlies[0]);
    }
  } else if (card.type === "structure") {
    const h = gameState.get('height');
    const w = gameState.get('width');
    // Place a turret spawn point
    gameState.addGameObject(new Headquarters(w / 2 - 40, h - 100, "player"));
    console.log(`Structure placed: ${card.name}`);
  }
}
