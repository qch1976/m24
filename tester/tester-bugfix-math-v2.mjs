// Tester独立验证INPUT-03 bugfix数学层：20正例（结果=24）+ 20反例（5除零+15not_24）
// 每个用例注释：// 算式 = 结果
import Solver from '../js/core/Solver.mjs';

// ========== 正例：20组，全部结果必须=24 ==========
const positiveCases = [
  {
    name: 'TC-bf-01',
    cardValues: [13, 1, 8, 4],
    tokens: [
      {type: 'left_paren'},
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 1},
      {type: 'right_paren'},
      {type: 'operator', value: '*'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '/'},
      {type: 'number', cardIndex: 3},
      {type: 'right_paren'},
    ],
    // (13-1)*(8/4) = 12*2 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-02',
    cardValues: [3, 8, 1, 1],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 3},
    ],
    // 3*8*1*1 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-03',
    cardValues: [6, 4, 1, 1],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 3},
    ],
    // 6*4*1*1 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-04',
    cardValues: [0, 3, 8, 1],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 3},
    ],
    // 0 + 3*8*1 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-05',
    cardValues: [13, 2, 1, 1],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 3},
    ],
    // 13*2 - 1 - 1 = 26 - 2 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-06',
    cardValues: [8, 3, 4, 1],
    tokens: [
      {type: 'left_paren'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 3},
      {type: 'right_paren'},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 1},
    ],
    // (4-1)*8*3/3？不对：(4-1)*8*1 = 3*8 = 24 → 哦不，四个数字：(8 + 4) * (3 - 1) = 12*2 = 24
    // 重新索引：8(0), 3(1), 4(2), 1(3) → (0+2)*(1-3) = (8+4)*(3-1) = 12*2=24
    cardValues: [8, 3, 4, 1],
    tokens: [
      {type: 'left_paren'},
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'right_paren'},
      {type: 'operator', value: '*'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 3},
      {type: 'right_paren'},
    ],
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-07',
    cardValues: [2, 6, 3, 4],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 3},
    ],
    // 2*6 + 3*4 = 12 + 12 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-08',
    cardValues: [2, 2, 3, 3],
    tokens: [
      {type: 'left_paren'},
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 1},
      {type: 'right_paren'},
      {type: 'operator', value: '*'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
      {type: 'right_paren'},
    ],
    // (2+2)*(3+3) = 4*6 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-09',
    cardValues: [0, 0, 12, 12],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
    ],
    // 0+0+12+12 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-10',
    cardValues: [10, 8, 3, 3],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
    ],
    // 10+8+3+3 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-11',
    cardValues: [9, 3, 4, 2],
    tokens: [
      {type: 'left_paren'},
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 1},
      {type: 'right_paren'},
      {type: 'operator', value: '*'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 3},
      {type: 'right_paren'},
    ],
    // (9+3)*(4-2) = 12*2 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-12',
    cardValues: [5, 5, 1, 1],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '-'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '/'},
      {type: 'number', cardIndex: 3},
      {type: 'right_paren'},
    ],
    // 5*5 - (1/1) = 25 - 1 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-13',
    cardValues: [6, 4, 2, 8],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '*'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 3},
      {type: 'operator', value: '/'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 2},
      {type: 'right_paren'},
      {type: 'right_paren'},
    ],
    // 6*(8/(4-2)) = 6*(8/2) = 6*4 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-14',
    cardValues: [8, 10, 7, 1],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '*'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 2},
      {type: 'right_paren'},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 3},
    ],
    // 8*(10-7)*1 = 8*3*1 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-15',
    cardValues: [4, 4, 4, 4],
    tokens: [
      {type: 'left_paren'},
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 1},
      {type: 'right_paren'},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
    ],
    // 4*4 + 4 + 4 = 16 + 8 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-16',
    cardValues: [9, 3, 1, 2],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '-'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
      {type: 'right_paren'},
    ],
    // 9*3 - (1+2) = 27 - 3 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-17',
    cardValues: [2, 9, 5, 4],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '*'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'right_paren'},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 3},
    ],
    // 2*(9+5) - 4 = 2*14 - 4 = 28 - 4 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-18',
    cardValues: [4, 5, 1, 1],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '*'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'right_paren'},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 3},
    ],
    // 4*(5+1)*1 = 4*6*1 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-19',
    cardValues: [7, 1, 2, 4],
    tokens: [
      {type: 'left_paren'},
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 2},
      {type: 'right_paren'},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 3},
    ],
    // (7+1-2)*4 = 6*4 = 24
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  },
  {
    name: 'TC-bf-20',
    cardValues: [12, 1, 12, 0],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '*'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
      {type: 'right_paren'},
    ],
    // 12 + 12*(1+0) = 12 + 12*1 = 24 → 索引 0/1/2/3 各一次
    expectedIs24: true,
    expectedSuccess: true,
    expectedValue: 24
  }
];

// ========== 反例：20组，5除零 + 15not_24 ==========
const negativeCases = [
  // 除零反例
  {
    name: 'TC-bf-21',
    cardValues: [1, 2, 2, 5],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '/'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 2},
      {type: 'right_paren'},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 3},
    ],
    // (1 ÷ (2-2)) × 5 = 除零仍触发 → 4张牌各一次
    expectedError: 'division_by_zero',
    expectedIs24: false
  },
  {
    name: 'TC-bf-22',
    cardValues: [10, 5, 5, 8],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '/'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 2},
      {type: 'right_paren'},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
    ],
    // 10 ÷ (5-5) + 8 = 除零仍触发 → 4张牌各一次
    expectedError: 'division_by_zero',
    expectedIs24: false
  },
  {
    name: 'TC-bf-23',
    cardValues: [5, 3, 3, 2],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '/'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 2},
      {type: 'right_paren'},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
    ],
    // 5 ÷ (3-3) + 2 = 除零仍触发 → 4张牌各一次
    expectedError: 'division_by_zero',
    expectedIs24: false
  },
  {
    name: 'TC-bf-24',
    cardValues: [2, 13, 13, 7],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '/'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 2},
      {type: 'right_paren'},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 3},
    ],
    // 2 ÷ (13-13) - 7 = 除零仍触发 → 4张牌各一次
    expectedError: 'division_by_zero',
    expectedIs24: false
  },
  {
    name: 'TC-bf-25',
    cardValues: [12, 0, 0, 5],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '/'},
      {type: 'left_paren'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 2},
      {type: 'right_paren'},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
    ],
    // 12 ÷ (0×0) + 5 = 除零仍触发 → 4张牌各一次
    expectedError: 'division_by_zero',
    expectedIs24: false
  },
  // not_24反例
  {
    name: 'TC-bf-26',
    cardValues: [1, 2, 3, 4],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
    ],
    // 1+2+3+4 = 10 ≠ 24
    expectedValue: 10,
    expectedIs24: false,
    expectedSuccess: true
  },
  {
    name: 'TC-bf-27',
    cardValues: [1, 2, 10, 10],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
    ],
    // 1+2+10+10 = 23 ≠ 24
    expectedValue: 23,
    expectedIs24: false,
    expectedSuccess: true
  },
  {
    name: 'TC-bf-28',
    cardValues: [2, 3, 1, 1],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 3},
    ],
    // 2*3*1*1 = 6 ≠ 24
    expectedValue: 6,
    expectedIs24: false,
    expectedSuccess: true
  },
  {
    name: 'TC-bf-29',
    cardValues: [12, 6, 3, 2],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 3},
    ],
    // 12-6-3-2 = 1 ≠ 24
    expectedValue: 1,
    expectedIs24: false,
    expectedSuccess: true
  },
  {
    name: 'TC-bf-30',
    cardValues: [10, 2, 5, 2],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 3},
    ],
    // 10-2-5-2 = 1 ≠ 24
    expectedValue: 1,
    expectedIs24: false,
    expectedSuccess: true
  },
  {
    name: 'TC-bf-31',
    cardValues: [8, 4, 3, 3],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
    ],
    // 8+4+3+3 = 18 ≠ 24
    expectedValue: 18,
    expectedIs24: false,
    expectedSuccess: true
  },
  {
    name: 'TC-bf-32',
    cardValues: [0, 1, 2, 3],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
    ],
    // 0+1+2+3 = 6 ≠ 24
    expectedValue: 6,
    expectedIs24: false,
    expectedSuccess: true
  },
  {
    name: 'TC-bf-33',
    cardValues: [5, 4, 1, 1],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
    ],
    // 5*4+1+1 = 20+2 = 22 ≠ 24
    expectedValue: 22,
    expectedIs24: false,
    expectedSuccess: true
  },
  {
    name: 'TC-bf-34',
    cardValues: [6, 6, 1, 0],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
    ],
    // 6+6+1+0 = 13 ≠ 24
    expectedValue: 13,
    expectedIs24: false,
    expectedSuccess: true
  },
  {
    name: 'TC-bf-35',
    cardValues: [9, 9, 3, 2],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '/'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 3},
    ],
    // (9/9)*3*2 = 1*6 = 6 ≠ 24
    expectedValue: 6,
    expectedIs24: false,
    expectedSuccess: true
  },
  {
    name: 'TC-bf-36',
    cardValues: [7, 3, 5, 3],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
    ],
    // 7+3+5+3 = 18 ≠ 24
    expectedValue: 18,
    expectedIs24: false,
    expectedSuccess: true
  },
  {
    name: 'TC-bf-37',
    cardValues: [4, 5, 6, 3],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
    ],
    // 4+5+6+3 = 18 ≠ 24
    expectedValue: 18,
    expectedIs24: false,
    expectedSuccess: true
  },
  {
    name: 'TC-bf-38',
    cardValues: [2, 5, 2, 3],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '*'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
    ],
    // 2*5+2+3 = 10+5 = 15 ≠ 24
    expectedValue: 15,
    expectedIs24: false,
    expectedSuccess: true
  },
  {
    name: 'TC-bf-39',
    cardValues: [11, 11, 1, 0],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '+'},
      {type: 'number', cardIndex: 3},
    ],
    // 11+11+1+0 = 23 ≠ 24
    expectedValue: 23,
    expectedIs24: false,
    expectedSuccess: true
  },
  {
    name: 'TC-bf-40',
    cardValues: [13, 5, 3, 2],
    tokens: [
      {type: 'number', cardIndex: 0},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 1},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 2},
      {type: 'operator', value: '-'},
      {type: 'number', cardIndex: 3},
    ],
    // 13-5-3-2 = 3 ≠ 24
    expectedValue: 3,
    expectedIs24: false,
    expectedSuccess: true
  }
];

function runPositiveCase(testCase) {
  console.log(`\n---------- 正例 ${testCase.name} ----------`);
  console.log(`牌点数: [${testCase.cardValues.join(', ')}]`);
  const result = Solver.evaluateExpression(testCase.tokens, testCase.cardValues);
  console.log(`Solver 返回: success=${result.success}`);
  if (result.success) {
    const actualValue = result.value.num / result.value.den;
    console.log(`计算结果: ${actualValue} (${result.value.num}/${result.value.den})`);
    console.log(`是否24: ${Solver.is24Fraction(result.value)}`);
    const pass = result.success && Solver.is24Fraction(result.value) === testCase.expectedIs24;
    console.log(`测试结果: ${pass ? '✅ PASS' : '❌ FAIL'}`);
    return pass;
  } else {
    console.log(`错误: ${result.error}`);
    console.log(`测试结果: ❌ FAIL (预期成功，实际失败)`);
    return false;
  }
}

function runNegativeCase(testCase) {
  console.log(`\n---------- 反例 ${testCase.name} ----------`);
  console.log(`牌点数: [${testCase.cardValues.join(', ')}]`);
  const result = Solver.evaluateExpression(testCase.tokens, testCase.cardValues);
  console.log(`Solver 返回: success=${result.success}`);
  
  if (testCase.expectedError === 'division_by_zero') {
    const pass = !result.success && result.error === 'division_by_zero';
    console.log(`预期: division_by_zero，实际: ${result.error}`);
    console.log(`测试结果: ${pass ? '✅ PASS' : '❌ FAIL'}`);
    return pass;
  } else {
    // 结果≠24
    if (!result.success) {
      console.log(`错误: ${result.error}`);
      console.log(`测试结果: ❌ FAIL (预期成功，实际失败)`);
      return false;
    }
    const actualValue = result.value.num / result.value.den;
    console.log(`计算结果: ${actualValue}，预期: ${testCase.expectedValue}`);
    console.log(`是否24: ${Solver.is24Fraction(result.value)}，预期: ${testCase.expectedIs24}`);
    const pass = result.success && (Solver.is24Fraction(result.value) === testCase.expectedIs24);
    const valueMatch = Math.abs(actualValue - testCase.expectedValue) < 1e-9;
    console.log(`数值匹配: ${valueMatch}`);
    console.log(`测试结果: ${pass && valueMatch ? '✅ PASS' : '❌ FAIL'}`);
    return pass && valueMatch;
  }
}

console.log('===== Tester 独立重新设计 20正例 + 20反例 测试 (INPUT-03 bugfix) =====\n');

let totalPassed = 0;
let totalCases = 0;

console.log('===== 开始正例测试（全部必须结果=24）=====');
positiveCases.forEach(c => {
  totalCases++;
  if (runPositiveCase(c)) totalPassed++;
});

console.log('\n===== 开始反例测试（5除零 + 15 not_24）=====');
negativeCases.forEach(c => {
  totalCases++;
  if (runNegativeCase(c)) totalPassed++;
});

console.log('\n\n===== 最终总结 =====');
console.log(`总用例: ${totalCases}, 通过: ${totalPassed}, 失败: ${totalCases - totalPassed}`);

if (totalPassed === totalCases) {
  console.log('\n✅ 所有测试用例全部通过！');
  process.exit(0);
} else {
  console.log('\n❌ 有测试用例失败');
  process.exit(1);
}
