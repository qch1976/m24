import { findSolutionsWithAST, toCanonicalKeyV2, intToFraction } from '../../js/core/Solver.mjs';
const decks20 = [[1,3,5,8],[2,3,4,6],[3,3,8,8],[1,5,5,5],[4,6,7,8],[2,5,7,9],[1,4,10,11],[2,6,6,8],[3,4,7,10],[5,7,8,9],[1,2,3,12],[4,4,10,10],[6,6,6,6],[1,8,12,3],[2,7,11,13],[1,2,8,8],[1,3,3,5],[1,4,6,8],[2,2,10,10],[3,5,6,8]];
console.log('=== fc3f1cc 基线（旧 canonical key）在 20 副牌上的解数 ===');
for (const d of decks20) {
  const s = findSolutionsWithAST(d, 24);
  console.log(`  [${d.join(',').padEnd(15)}]  解数=${s.length}${s.length===0?' ⚠️ 不可解':''}`);
}
const n = (v) => ({ op: 'num', value: intToFraction(v), label: String(v) });
const bin = (op, l, r) => ({ op, args: [l, r] });
console.log('\n=== fc3f1cc GCD 边界观察 ===');
const k = toCanonicalKeyV2;
console.log(`  6÷2 key = ${k(bin('/', n(6), n(2)))}`);
console.log(`  4÷2 key = ${k(bin('/', n(4), n(2)))}`);
console.log(`  (3×4)÷(2×6) key = ${k(bin('/', bin('*', n(3), n(4)), bin('*', n(2), n(6))))}`);
