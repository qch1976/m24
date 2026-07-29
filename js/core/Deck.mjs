// m24 - Deck.mjs (ESM copy for Node self-test, minimal for INPUT-05)
import { buildFullDeck } from './Card.mjs';
import { shuffle } from '../utils/Random.mjs';
import Solver from './Solver.mjs';

const MAX_RESHUFFLE = 10;
export default class Deck {
  constructor() {
    this.cards = buildFullDeck();
    this.dealtCards = [];
  }
  shuffle() { this.cards = shuffle(this.cards); return this; }
  deal(n = 4) {
    this.shuffle();
    this.dealtCards = this.cards.slice(0, n);
    return this.dealtCards;
  }
  dealSolvable(n = 4, target = 24) {
    if (n !== 4) return this.deal(n);
    let last = null;
    for (let attempt = 1; attempt <= MAX_RESHUFFLE; attempt++) {
      const cards = this.deal(n);
      last = cards;
      const values = cards.map(c => c.value);
      if (Solver.isSolvable(values, target)) return cards;
    }
    throw new Error(`Deck.dealSolvable: ${MAX_RESHUFFLE} attempts failed (last=${last ? last.map(c => c.value).join(',') : 'n/a'})`);
  }
  getDealtCards() { return this.dealtCards.slice(); }
  size() { return this.cards.length; }
  reset() { this.cards = buildFullDeck(); this.dealtCards = []; }
}
