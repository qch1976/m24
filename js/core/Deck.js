// m24 - Deck.js
// 牌堆：每轮独立洗牌，无放回抽 4 张（Fisher-Yates）
// 允许发出大小王；每次 deal() = 从 54 张全牌堆重新洗牌抽 4 张

import { buildFullDeck } from './Card';
import { shuffle } from '../utils/Random';
import Solver from './Solver';

const MAX_RESHUFFLE = 10; // INPUT-02: 可解性重抽上限

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

  /**
   * INPUT-02：发出一手【可解】的 4 张牌。
   * 内部反复调用 deal(n)，直到 Solver.isSolvable 通过；上限 MAX_RESHUFFLE 次。
   * 现有 deal() 方法字节保持不变（保护清单约束）；本方法为新增 API。
   *
   * @param {number} n 期望张数，默认 4
   * @param {number} [target=24] 目标值
   * @returns {Card[]} 已保证可解的 n 张牌
   * @throws Error 若连续 MAX_RESHUFFLE 次都无解，则抛异常上抛（不静默失败）
   */
  dealSolvable(n = 4, target = 24) {
    if (n !== 4) {
      // 目前 Solver 只面向 4 数场景；其它规模退化为普通发牌以保持兼容
      return this.deal(n);
    }
    let lastCards = null;
    for (let attempt = 1; attempt <= MAX_RESHUFFLE; attempt++) {
      const cards = this.deal(n);
      lastCards = cards;
      const values = cards.map((c) => c.value);
      if (Solver.isSolvable(values, target)) {
        return cards;
      }
    }
    throw new Error(
      `Deck.dealSolvable: 连续 ${MAX_RESHUFFLE} 次未抽到可解组合，请检查` +
        `（最后一次: ${lastCards ? lastCards.map((c) => c.value).join(',') : 'n/a'}）`
    );
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
