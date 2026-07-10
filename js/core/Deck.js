// m24 - Deck.js
// 牌堆：每轮独立洗牌，无放回抽 4 张（Fisher-Yates）
// 允许发出大小王；每次 deal() = 从 54 张全牌堆重新洗牌抽 4 张

import { buildFullDeck } from './Card';
import { shuffle } from '../utils/Random';

export default class Deck {
  constructor() {
    this.cards = buildFullDeck(); // 完整 54 张
    this.dealtCards = [];
  }

  /**
   * 洗牌
   */
  shuffle() {
    this.cards = shuffle(this.cards);
    return this;
  }

  /**
   * 每次点击 = 一次完整洗牌 + 无放回抽 N 张
   * 默认 N=4
   */
  deal(n = 4) {
    if (n <= 0 || n > this.cards.length) {
      throw new Error(`Deck.deal: invalid count ${n}`);
    }
    this.shuffle();
    // 无放回：直接取前 n 张，不再考虑剩余
    this.dealtCards = this.cards.slice(0, n);
    return this.dealtCards;
  }

  getDealtCards() {
    return this.dealtCards.slice();
  }

  size() {
    return this.cards.length;
  }

  /**
   * 完全重置：重建完整 54 张
   */
  reset() {
    this.cards = buildFullDeck();
    this.dealtCards = [];
  }
}
