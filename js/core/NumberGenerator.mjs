// m24 - NumberGenerator.js
// 生成 4 个 1-13 的随机数字（骨架版）
// TODO(D2-01)：配合 Solver.js 保证生成的数字组合一定有解

export default class NumberGenerator {
  static generateNumbers(range = 13, count = 4) {
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(Math.floor(Math.random() * range) + 1);
    }
    return result;
  }
}
