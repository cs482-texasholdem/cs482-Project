//Author: Camila Cosme

//function to display card and suite
function cardToText(cardNumber) {
  const suits = ["♥", "♦", "♣", "♠"];
  const ranks = ["2", "3", "4", "5", "6", "7",
                 "8", "9", "10", "J", "Q", "K", "A"];
  if (!Number.isInteger(cardNumber) || cardNumber < 1 || cardNumber > 52) {
    throw new Error("Card ID must be an integer from 1 to 52");
  }
  const suitIndex = Math.floor((cardNumber - 1) / 13); 
  const rankIndex = (cardNumber - 1) % 13;

  return ranks[rankIndex] + suits[suitIndex];
}

//allows for Jest to run code by exporting function cardToText
module.exports = { cardToText };
