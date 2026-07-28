// Tester额外新增3个除零用例，不与Developer原有3组重叠
import Solver from '../js/core/Solver.mjs';

// 额外除零用例：
// 1. 2 ÷ (13 - 13) → K-K=0
const case1 = {
  cardValues: [2, 13, 13, 0],
  tokens: [
    {type: 'number', cardIndex: 0},
    {type: 'operator', value: '/'},
    {type: 'left_paren'},
    {type: 'number', cardIndex: 1},
    {type: 'operator', value: '-'},
    {type: 'number', cardIndex: 2},
    {type: 'right_paren'}
  ]
};

// 2. 1 ÷ (7 - 7) → A ÷ (7-7)
const case2 = {
  cardValues: [1, 7, 7, 5],
  tokens: [
    {type: 'number', cardIndex: 0},
    {type: 'operator', value: '/'},
    {type: 'left_paren'},
    {type: 'number', cardIndex: 1},
    {type: 'operator', value: '-'},
    {type: 'number', cardIndex: 2},
    {type: 'right_paren'}
  ]
};

// 3. 12 ÷ (0 × 0) → 大小王乘以大小王=0，做除数
const case3 = {
  cardValues: [12, 0, 0, 0],
  tokens: [
    {type: 'number', cardIndex: 0},
    {type: 'operator', value: '/'},
    {type: 'left_paren'},
    {type: 'number', cardIndex: 1},
    {type: 'operator', value: '*'},
    {type: 'number', cardIndex: 2},
    {type: 'right_paren'}
  ]
};

function runCase(name, testCase) {
  console.log(`\n===== 测试用例 ${name} =====`);
  console.log(`牌点数: [${testCase.cardValues.join(', ')}]`);
  const result = Solver.evaluateExpression(testCase.tokens, testCase.cardValues);
  console.log(`Solver 返回:`, JSON.stringify(result, null, 2));
  
  const hasInfinity = result?.value?.num === Infinity || result?.value?.den === Infinity || 
                    result?.value?.num === -Infinity || result?.value?.den === -Infinity ||
                    Number.isNaN(result?.value?.num) || Number.isNaN(result?.value?.den);
  
  console.log(`是否含Infinity/NaN: ${hasInfinity}`);
  console.log(`预期结果: success=false, error=division_by_zero，无Infinity/NaN`);
  const pass = !result.success && result.error === 'division_by_zero' && !hasInfinity;
  console.log(`测试结果: ${pass ? '✅ PASS' : '❌ FAIL'}`);
  return pass;
}

console.log('===== Tester 新增3个除零用例测试 =====\n');
const pass1 = runCase('2÷(13-13) (K-K)', case1);
const pass2 = runCase('1÷(7-7)', case2);
const pass3 = runCase('12÷(0×0)', case3);

console.log('\n===== 总结 =====');
const total = 3;
const passed = [pass1, pass2, pass3].filter(p => p).length;
console.log(`total: ${total}, pass: ${passed}, fail: ${total - passed}`);

if (passed === total) {
  console.log('\n✅ 所有新增除零用例测试通过');
  process.exit(0);
} else {
  console.log('\n❌ 有测试用例失败');
  process.exit(1);
}
