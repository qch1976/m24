// self-test: simulate 30 rounds of dealing, verify no duplicates within a round, count joker appearances
// Since files use ES modules with import from '../utils/...', we use dynamic import via a tiny wrapper
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load Card & Deck modules via file URL relative to project
const projectRoot = resolve(__dirname, '..');
const cardMod = await import(`file://${projectRoot}/js/core/Card.js`);
const deckMod = await import(`file://${projectRoot}/js/core/Deck.js`);
const Deck = deckMod.default;
const { buildFullDeck } = cardMod;

const fullDeck = buildFullDeck();
console.log('Full deck size:', fullDeck.length);
if (fullDeck.length !== 54) {
  console.error('FAIL: full deck not 54');
  process.exit(1);
}

const deck = new Deck();
let jokerRounds = 0;
let bigJokerCount = 0;
let smallJokerCount = 0;
for (let i = 1; i <= 30; i++) {
  const dealt = deck.deal(4);
  if (dealt.length !== 4) {
    console.error(`Round ${i} FAIL: dealt count ${dealt.length}`);
    process.exit(1);
  }
  const ids = new Set(dealt.map((c) => c.id));
  if (ids.size !== 4) {
    console.error(`Round ${i} FAIL: duplicate cards`, dealt.map((c) => c.id));
    process.exit(1);
  }
  const jokers = dealt.filter((c) => c.isJoker);
  if (jokers.length > 0) jokerRounds++;
  bigJokerCount += dealt.filter((c) => c.id === 'joker-big').length;
  smallJokerCount += dealt.filter((c) => c.id === 'joker-small').length;
  const desc = dealt.map((c) => `${c.displayRank}${c.isJoker ? '' : '(' + c.suit + ')'}=${c.value}`).join(', ');
  console.log(`Round ${i}: ${desc}`);
}
console.log(`\nJoker rounds: ${jokerRounds}/30, big joker seen: ${bigJokerCount}, small joker seen: ${smallJokerCount}`);
console.log('All 30 rounds passed.');
