// selftest_input05_solver.mjs — R-02
// solvable 模式 100 次全部有解
import { generateSolvable } from '../js/core/DealGenerator.mjs';
import Solver from '../js/core/Solver.mjs';

let ok = 0, fail = 0;
const failures = [];
for (let i = 0; i < 100; i++) {
  const cards = generateSolvable();
  const values = cards.map(c => c.value);
  if (Solver.isSolvable(values, 24)) ok++;
  else { fail++; failures.push({ i, values }); }
}
console.log(`[selftest_input05_solver] R-02 solvable 100 tests: ok=${ok} fail=${fail}`);
if (fail > 0) {
  console.log('failures:', JSON.stringify(failures));
  process.exit(1);
}
console.log('PASS');
process.exit(0);
