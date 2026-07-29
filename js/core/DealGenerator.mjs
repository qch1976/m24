// m24 - DealGenerator.mjs (ESM copy for Node self-test)
import Deck from './Deck.mjs';
import { buildFullDeck } from './Card.mjs';
import { shuffle } from '../utils/Random.mjs';
import { DEAL_MODE } from './Settings.mjs';

export function generate(dealMode, sharedDeck) {
  if (dealMode === DEAL_MODE.RANDOM) return generateRandom(sharedDeck);
  return generateSolvable(sharedDeck);
}
export function generateSolvable(sharedDeck) {
  const deck = sharedDeck || new Deck();
  return deck.dealSolvable(4);
}
export function generateRandom(sharedDeck) {
  const full = buildFullDeck();
  const shuffled = shuffle(full);
  const four = shuffled.slice(0, 4);
  if (sharedDeck) {
    sharedDeck.cards = shuffled;
    sharedDeck.dealtCards = four;
  }
  return four;
}
export default { generate, generateSolvable, generateRandom };
