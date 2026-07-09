// m24 - GameData.js
// 游戏运行时常量与初始状态定义

export const OPERATORS = ['+', '-', '×', '÷'];

export const DEFAULT_GAME_STATE = () => ({
  status: 'idle',
  numbers: [],
  selectedNumbers: [],
  selectedOperators: [],
  currentExpression: '',
  score: 0,
  time: 0,
  level: 1,
});

export const DIFFICULTY = {
  EASY: { range: 10, timeLimit: 60 },
  NORMAL: { range: 13, timeLimit: 45 },
  HARD: { range: 13, timeLimit: 30 },
};
