import { toCanonicalKeyV2, intToFraction, findSolutionsWithAST, formatExprPretty } from '../../js/core/Solver.mjs';
const n = (v) => ({ op: 'num', value: intToFraction(v), label: String(v) });
const bin = (op, l, r) => ({ op, args: [l, r] });

console.log('=== T-11 ~ T-18: pretty golden ===');
const prettyCases = [
  { id: 'T-11', ast: bin('*', bin('*', n(3), n(5)), n(2)), expect: '3×5×2' },
  { id: 'T-12', ast: bin('/', bin('*', n(3), n(5)), n(2)), expect: '3×5÷2' },
  { id: 'T-13', ast: bin('/', n(24), bin('*', n(2), n(3))), expect: '24÷(2×3)' },
  { id: 'T-14', ast: bin('/', bin('/', n(24), n(2)), n(3)), expect: '24÷2÷3' },
  { id: 'T-15', ast: bin('/', n(24), bin('/', n(6), n(3))), expect: '24÷(6÷3)' },
  { id: 'T-16', ast: bin('*', n(3), bin('/', n(24), n(3))), expect: '3×24÷3' },
  { id: 'T-17', ast: bin('/', bin('*', n(3), n(4)), bin('*', n(2), n(1))), expect: '3×4÷(2×1)' },
  { id: 'T-18', ast: bin('*', bin('+', bin('*', n(2), n(8)), n(8)), n(1)), expect: '(2×8+8)×1' },
];
let pass = 0, fail = 0;
for (const c of prettyCases) {
  const got = formatExprPretty(c.ast);
  const ok = got === c.expect;
  const flag = ok ? '✅' : '❌';
  console.log(`${flag} ${c.id}  expect="${c.expect}"  got="${got}"`);
  if (ok) pass++; else fail++;
}
console.log(`\n汇总 pretty: ${pass} pass / ${fail} fail`);

// —— task-75：pass/fail 此前已算出但未用于退出码 ——
console.log(`[99-verify-solver-full] pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);

console.log('\n=== 276b824 vs fc3f1cc 解数对比（哪些牌局解数改变？） ===');
const decks20 = [[1,3,5,8],[2,3,4,6],[3,3,8,8],[1,5,5,5],[4,6,7,8],[2,5,7,9],[1,4,10,11],[2,6,6,8],[3,4,7,10],[5,7,8,9],[1,2,3,12],[4,4,10,10],[6,6,6,6],[1,8,12,3],[2,7,11,13],[1,2,8,8],[1,3,3,5],[1,4,6,8],[2,2,10,10],[3,5,6,8]];
const baselineCounts = { '1,3,5,8':3,'2,3,4,6':14,'3,3,8,8':1,'1,5,5,5':1,'4,6,7,8':7,'2,5,7,9':1,'1,4,10,11':1,'2,6,6,8':5,'3,4,7,10':4,'5,7,8,9':2,'1,2,3,12':7,'4,4,10,10':1,'6,6,6,6':2,'1,8,12,3':7,'2,7,11,13':0,'1,2,8,8':6,'1,3,3,5':6,'1,4,6,8':7,'2,2,10,10':2,'3,5,6,8':12 };
for (const d of decks20) {
  const s = findSolutionsWithAST(d, 24);
  const key = d.join(',');
  const base = baselineCounts[key];
  const arrow = s.length === base ? '=' : (s.length < base ? '↓收缩' : '↑扩张⚠️');
  console.log(`  [${key.padEnd(15)}]  fc3f1cc=${base}  276b824=${s.length}  ${arrow}`);
}
