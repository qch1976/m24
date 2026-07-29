// m24 - DealGenerator.js
// INPUT-05：发牌模式分派
// 依据：106-INPUT05-需求分析与设计.md §5
//
// 输入：dealMode: 'solvable' | 'random'（未识别值降级为 'solvable'）
// 输出：4 张 Card 实例数组
//
// - solvable 分支：完全复用 INPUT-02 Deck.dealSolvable(4)（内部走 Solver 可解筛选）
// - random   分支：从 54 张牌一次无放回抽 4 张（Fisher-Yates 前 4 张）
//                  严禁"solutions.length===0 就重抽"；不检查解数，纯 uniform sample

import Deck from './Deck';
import { buildFullDeck } from './Card';
import { shuffle } from '../utils/Random';
import { DEAL_MODE } from './Settings';

/**
 * 发牌：根据模式返回 4 张 Card。
 * @param {'solvable'|'random'} dealMode
 * @param {Deck} [sharedDeck] 可选：复用外部 Deck 实例（保持 dealtCards 语义一致）
 * @returns {Card[]}
 */
export function generate(dealMode, sharedDeck) {
  if (dealMode === DEAL_MODE.RANDOM) {
    return generateRandom(sharedDeck);
  }
  // 默认 solvable（含降级）
  return generateSolvable(sharedDeck);
}

/**
 * solvable：完全复用 INPUT-02 已锁定 Deck.dealSolvable(4)
 */
export function generateSolvable(sharedDeck) {
  const deck = sharedDeck || new Deck();
  return deck.dealSolvable(4);
}

/**
 * random：从 54 张牌 uniform 抽样 4 张，禁止重抽
 * 若传入 sharedDeck，则同步更新其 dealtCards 保持一致
 */
export function generateRandom(sharedDeck) {
  const full = buildFullDeck();          // 每次重建 54 张，避免污染
  const shuffled = shuffle(full);        // Fisher-Yates
  const four = shuffled.slice(0, 4);
  if (sharedDeck) {
    sharedDeck.cards = shuffled;
    sharedDeck.dealtCards = four;
  }
  return four;
}

export default { generate, generateSolvable, generateRandom };
