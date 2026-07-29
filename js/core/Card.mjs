// m24 - Card.mjs (ESM version for Node self-test)
export const RANK_VALUE = {
  A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
  J: 11, Q: 12, K: 13, big: 0, small: 0,
};
export const SUITS = ['spade', 'heart', 'diamond', 'club'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export default class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.value = RANK_VALUE[rank];
    if (typeof this.value !== 'number') throw new Error(`Card: unknown rank "${rank}"`);
    this.id = suit === 'joker' ? `joker-${rank}` : `${suit}-${rank}`;
    this.isJoker = suit === 'joker';
    this.isRed = suit === 'heart' || suit === 'diamond';
    this.displayRank = rank === 'big' ? '大王' : rank === 'small' ? '小王' : rank;
  }
}
export function buildFullDeck() {
  const cards = [];
  for (const s of SUITS) for (const r of RANKS) cards.push(new Card(s, r));
  cards.push(new Card('joker', 'big'));
  cards.push(new Card('joker', 'small'));
  return cards;
}
