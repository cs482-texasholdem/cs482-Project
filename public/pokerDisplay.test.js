const { cardToText } = require("./pokerdisplay.js");

test("converts hearts correctly", () => {
  expect(cardToText(1)).toBe("A♥");
  expect(cardToText(10)).toBe("10♥");
  expect(cardToText(11)).toBe("J♥");
  expect(cardToText(12)).toBe("Q♥");
  expect(cardToText(13)).toBe("K♥");
});

test("converts diamonds correctly", () => {
  expect(cardToText(14)).toBe("A♦");
  expect(cardToText(26)).toBe("K♦");
});

test("converts clubs correctly", () => {
  expect(cardToText(27)).toBe("A♣");
  expect(cardToText(39)).toBe("K♣");
});

test("converts spades correctly", () => {
  expect(cardToText(40)).toBe("A♠");
  expect(cardToText(52)).toBe("K♠");
});
