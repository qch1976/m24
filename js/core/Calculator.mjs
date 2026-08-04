// m24 - Calculator.js
// 表达式栈管理与 24 点判定（骨架版）
// TODO(D2-05)：接入完整表达式解析

export default class Calculator {
  constructor() {
    this.numbers = [];
    this.stack = [];
    this.expression = '';
  }

  reset(numbers) {
    this.numbers = numbers.slice();
    this.stack = [];
    this.expression = '';
  }

  selectNumber(_index) {
    // TODO: 将指定索引的数字压入表达式栈
  }

  selectOperator(_operator) {
    // TODO: 将运算符压入表达式栈
  }

  calculate() {
    // TODO: 求值逻辑
    return null;
  }

  checkResult(result) {
    return Math.abs(result - 24) < 1e-6;
  }

  getExpression() {
    return this.expression;
  }
}
