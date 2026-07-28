// 探测 276b824 GCD 约简是否越界代数化简
import { toCanonicalKeyV2, intToFraction } from '../../js/core/Solver.mjs';
const n = (v) => ({ op: 'num', value: intToFraction(v), label: String(v) });
const bin = (op, l, r) => ({ op, args: [l, r] });
const k = toCanonicalKeyV2;

console.log('=== 关键探测：GCD 约简是否越界 ===');
const cases = [
  ['6÷2',       bin('/', n(6), n(2)),                     '2'],
  ['4÷2',       bin('/', n(4), n(2)),                     '2'],
  ['8÷4',       bin('/', n(8), n(4)),                     '2'],
  ['(2×3)÷6',   bin('/', bin('*', n(2), n(3)), n(6)),     '1'],
  ['(3×4)÷(2×6)', bin('/', bin('*', n(3), n(4)), bin('*', n(2), n(6))), '1'],
  ['(3×8)÷(6×4)', bin('/', bin('*', n(3), n(8)), bin('*', n(6), n(4))), '1'],
];
for (const [desc, ast] of cases) {
  console.log(`  ${desc.padEnd(15)} → ${k(ast)}`);
}
console.log(`  常量 2  key = ${k(n(2))}`);
console.log(`  常量 3  key = ${k(n(3))}`);
console.log(`  常量 1  key = ${k(n(1))}`);
console.log('');
console.log('对齐 T-03 断言：a×2 ≠ a÷2 是否仍然通过？');
console.log(`  6×2 = ${k(bin('*', n(6), n(2)))}`);
console.log(`  6÷2 = ${k(bin('/', n(6), n(2)))}`);
console.log(`  是否 ≠ ？ ${k(bin('*', n(6), n(2))) !== k(bin('/', n(6), n(2)))}`);

console.log('\n=== 探测：GCD 副作用是否影响 "非 1 常量" 归一硬约束边界 ===');
// 硬约束语义："a×2 ≠ a÷2"（仅 1 参与才归一） - Bug 5.1 v2
// 但 276b824 的 GCD 约简会把 6÷2 和 3 合并（key 相同?）
console.log(`  6÷2  key = ${k(bin('/', n(6), n(2)))}`);
console.log(`  3    key = ${k(n(3))}`);
console.log(`  ⇒ 6÷2 ${k(bin('/', n(6), n(2))) === k(n(3)) ? '≡' : '≠'} 3 （值相等，若归一 = 越界代数化简）`);
console.log(`  8÷2  key = ${k(bin('/', n(8), n(2)))}`);
console.log(`  4    key = ${k(n(4))}`);
console.log(`  ⇒ 8÷2 ${k(bin('/', n(8), n(2))) === k(n(4)) ? '≡' : '≠'} 4`);
console.log('');
console.log('结论：GCD 约简保留了因子的多重集合结构（8÷2 → key=(*|n4/1)，与叶子 n4/1 不同），');
console.log('     所以硬约束 "a×2 ≠ a÷2 ≠ a" 仍然成立，但 8÷2 ≡ 4×1（值相同且都归一为单因子 n4/1）。');
console.log('     这是一个新的语义等价类，不违反 T-02/T-03 断言字面（key 字符串仍不同），');
console.log('     但**扩大**了等价类到 "值相同且 GCD 约简后形态相同" 的范围。');
