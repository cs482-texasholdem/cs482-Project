// Shared server-side list of approved avatar presets.
// Images can be added later without changing stored avatar IDs.

const avatarPresets = Object.freeze([
    { id: "default", name: "Default" },
    { id: "ace", name: "Ace of Spades" },
    { id: "queen", name: "Queen of Hearts" },
    { id: "king", name: "King of Diamonds" },
    { id: "jack", name: "Jack of Clubs" },
    { id: "joker", name: "Wild Joker" }
]);

const avatarIds = avatarPresets.map(preset => preset.id);

module.exports = { avatarPresets, avatarIds };