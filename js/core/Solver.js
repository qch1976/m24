// m24 - Solver.js
// 24 点解法穷举器（骨架版）
// TODO(D2-02)：递归穷举 4 个数字与 + - × ÷ 的所有组合，返回是否有解 & 表达式列表

const OPS = ['+', '-', '*', '/'];
const EPS = 1e-6;

export default class Solver {
  static hasSolution(numbers, target = 24) {
    const solutions = this.findSolutions(numbers, target, true);
    return solutions.length > 0;
  }

  static findSolutions(numbers, target = 24, firstOnly = false) {
    const solutions = [];
    const items = numbers.map((n) => ({ value: n, expr: String(n) }));
    this._dfs(items, target, solutions, firstOnly);
    return solutions;
  }

  static _dfs(items, target, solutions, firstOnly) {
    if (firstOnly && solutions.length > 0) return;
    if (items.length === 1) {
      if (Math.abs(items[0].value - target) < EPS) {
        solutions.push(items[0].expr);
      }
      return;
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;
        const a = items[i];
        const b = items[j];
        const rest = items.filter((_, k) => k !== i && k !== j);
        for (const op of OPS) {
          const combined = this._apply(a, b, op);
          if (!combined) continue;
          this._dfs([combined, ...rest], target, solutions, firstOnly);
          if (firstOnly && solutions.length > 0) return;
        }
      }
    }
  }

  static _apply(a, b, op) {
    let value;
    switch (op) {
      case '+':
        value = a.value + b.value;
        break;
      case '-':
        value = a.value - b.value;
        break;
      case '*':
        value = a.value * b.value;
        break;
      case '/':
        if (Math.abs(b.value) < EPS) return null;
        value = a.value / b.value;
        break;
      default:
        return null;
    }
    return { value, expr: `(${a.expr}${op}${b.expr})` };
  }
}
