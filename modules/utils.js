export function debugCardClicks() {
  document.addEventListener("click", function(e) {
    console.log("Document click on:", e.target);
    console.log("Closest card:", e.target.closest(".card"));
    console.log("Event path:", e.composedPath().map(el => el.tagName || el.id || el.className).join(' > '));
  }, true); // Use capture phase to see all clicks
}
