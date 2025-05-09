// Deck Builder UI logic
import { initCards, loadDeck } from './cards.js';
import * as gameState from './gameState.js';

export function openDeckBuilder(eMenu, eDeckB) {
  eMenu.style.display = "none";
  eDeckB.style.display = "flex";
  initCards();
  loadDeck();
}

export function closeDeckBuilder(gameState) {
  console.log("close deck builder click function called");
  gameState.showScreen('menu');
}

export function handleDeckBuilderClick(cardEl, toggleDeck) {
  const idx = parseInt(cardEl.dataset.cardIdx);
  if (isNaN(idx)) {
    console.error("Invalid card index in deck builder.");
    return;
  }
  console.log("Card clicked in deck builder:", idx, "From container:", cardEl.closest("#current-deck") ? "current-deck" : "collection");
  toggleDeck(idx, cardEl);
}
