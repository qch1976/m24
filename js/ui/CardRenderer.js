// m24 - CardRenderer.js
// 扑克牌渲染：Canvas 绘制卡牌正/反面（12-INPUT01-素材清单.md 4.2 备选方案）
// 支持翻转动画（0..1 进度，0=完全反面，1=完全正面）

import { roundRect } from './Components';

const CARD_BG = '#FFFFFF';
const CARD_BACK_BG = '#1F3A8A';
const CARD_BACK_STRIPE = '#2C4FBE';
const RED_COLOR = '#D32F2F';
const BLACK_COLOR = '#212121';
const JOKER_GOLD = '#D4A017';

const SUIT_SYMBOL = {
  spade: '\u2660',   // ♠
  heart: '\u2665',   // ♥
  diamond: '\u2666', // ♦
  club: '\u2663',    // ♣
};

function suitColor(card) {
  if (card.isJoker) return JOKER_GOLD;
  return card.isRed ? RED_COLOR : BLACK_COLOR;
}

/**
 * 绘制扑克牌反面
 */
function drawCardBack(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = CARD_BACK_BG;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  // 网格花纹
  ctx.strokeStyle = CARD_BACK_STRIPE;
  ctx.lineWidth = 1;
  const step = 10;
  ctx.beginPath();
  for (let i = -h; i < w; i += step) {
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + h, y + h);
  }
  for (let i = 0; i < w + h; i += step) {
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i - h, y + h);
  }
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 8);
  ctx.clip();
  ctx.stroke();
  ctx.restore();
  // 边框
  ctx.strokeStyle = '#0F1E4B';
  ctx.lineWidth = 2;
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 7);
  ctx.stroke();
  // 中央菱形 logo
  ctx.fillStyle = '#F5D400';
  ctx.beginPath();
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx + 10, cy);
  ctx.lineTo(cx, cy + 12);
  ctx.lineTo(cx - 10, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * 绘制扑克牌正面
 */
function drawCardFront(ctx, x, y, w, h, card) {
  ctx.save();
  ctx.fillStyle = CARD_BG;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = '#B0B0B0';
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 8);
  ctx.stroke();

  const color = suitColor(card);
  ctx.fillStyle = color;

  if (card.isJoker) {
    // 王牌：中央大字
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.displayRank, x + w / 2, y + h / 2);
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = color;
    // 左上、右下小字
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('JOKER', x + 5, y + 5);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('JOKER', x + w - 5, y + h - 5);
  } else {
    const rankText = card.rank;
    const suitSym = SUIT_SYMBOL[card.suit] || '';

    // 左上：点数 + 花色
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(rankText, x + 5, y + 5);
    ctx.font = '12px sans-serif';
    ctx.fillText(suitSym, x + 5, y + 20);

    // 右下：镜像
    ctx.save();
    ctx.translate(x + w - 5, y + h - 5);
    ctx.rotate(Math.PI);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(rankText, 0, 0);
    ctx.font = '12px sans-serif';
    ctx.fillText(suitSym, 0, 15);
    ctx.restore();

    // 中央大花色
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(suitSym, x + w / 2, y + h / 2);
  }
  ctx.restore();
}

/**
 * 绘制单张牌（支持翻转进度）
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} pos { x, y, w, h }
 * @param {Object|null} card - 若为 null / 未定义，且 flip==0，绘制反面
 * @param {number} flip - 0..1，0 完全反面，1 完全正面
 */
export function drawCard(ctx, pos, card, flip = 0) {
  const { x, y, w, h } = pos;
  // 翻转期间 x 方向缩放
  const scaleX = Math.abs(flip - 0.5) * 2; // 0.5->0, 0/1->1
  const showFront = flip >= 0.5;

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(scaleX || 0.01, 1);
  ctx.translate(-(x + w / 2), -(y + h / 2));

  if (showFront && card) {
    drawCardFront(ctx, x, y, w, h, card);
  } else {
    drawCardBack(ctx, x, y, w, h);
  }
  ctx.restore();
}

export default {
  drawCard,
};
