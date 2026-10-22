//Author: Camila Cosme
function cardToText(cardNumber) {
  const suits = ["♥", "♦", "♣", "♠"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7",
                 "8", "9", "10", "J", "Q", "K"];

  const suitIndex = Math.floor((cardNumber - 1) / 13);
  const rankIndex = (cardNumber - 1) % 13;

  return ranks[rankIndex] + suits[suitIndex];
}

if (typeof module !== "undefined") {
  module.exports = { cardToText };
}