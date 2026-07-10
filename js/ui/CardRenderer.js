// m24 - CardRenderer.js
// INPUT-01.1：改造为图片渲染优先 + Canvas 手绘降级
// INPUT-01.1 hotfix：卡面浅米白底 + 圆角深灰细描边 + 图片内缩 15%（正面/背面/手绘降级统一处理）
// 图片来源：hayeah/playing-cards-assets (MIT License) — 见 images/cards/LICENSE
// 命名约定：{suit}-{rank}.png / joker-big.png / joker-small.png / back.png
// 保留 INPUT-01 的手绘实现作为图片加载失败时的兜底，确保游戏可跑

import { roundRect } from './Components';

const CARD_BASE_PATH = 'images/cards/';

// hotfix 视觉常量（4 项一起改：底色 + 描边色 + 描边宽度 + 圆角半径 + 内缩比例）
const CARD_BASE_COLOR = '#FFFEF5';   // 浅米白（Bug1 修复）
const CARD_STROKE_COLOR = '#333333'; // 深灰细描边（额外需求）
const CARD_STROKE_WIDTH = 1;
const CARD_CORNER_RADIUS = 10;       // 8~10 DP，取 10 让 120×170 卡稍有质感
const CARD_INSET_RATIO = 0.15;       // 15% 内边距（Bug2 修复）

// 手绘降级用色
const CARD_BACK_BG = '#1F3A8A';
const CARD_BACK_STRIPE = '#2C4FBE';
const RED_COLOR = '#D32F2F';
const BLACK_COLOR = '#212121';
const JOKER_GOLD = '#D4A017';
const SUIT_SYMBOL = {
  spade: '\u2660',
  heart: '\u2665',
  diamond: '\u2666',
  club: '\u2663',
};

// 加载状态
const LOAD_STATE = {
  PENDING: 'pending',
  LOADED: 'loaded',
  FAILED: 'failed',
};

const imageCache = new Map(); // id -> Image
const imageState = new Map(); // id -> LOAD_STATE
let preloadStarted = false;
let preloadResolve = null;
let preloadPromise = null;

function _createImage() {
  if (typeof wx !== 'undefined' && wx.createImage) return wx.createImage();
  // 浏览器/开发者工具 fallback
  // eslint-disable-next-line no-undef
  return new Image();
}

function _allImageIds() {
  const ids = [];
  const suits = ['spade', 'heart', 'diamond', 'club'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  for (const s of suits) for (const r of ranks) ids.push(`${s}-${r}`);
  ids.push('joker-big');
  ids.push('joker-small');
  ids.push('back');
  return ids;
}

function _loadOne(id) {
  return new Promise((resolve) => {
    const img = _createImage();
    imageState.set(id, LOAD_STATE.PENDING);
    img.onload = () => {
      imageCache.set(id, img);
      imageState.set(id, LOAD_STATE.LOADED);
      resolve({ id, ok: true });
    };
    img.onerror = (err) => {
      imageState.set(id, LOAD_STATE.FAILED);
      console.warn('[CardRenderer] image load failed:', id, err);
      resolve({ id, ok: false });
    };
    img.src = `${CARD_BASE_PATH}${id}.png`;
  });
}

/**
 * 预加载全部 55 张扑克素材
 */
export function preloadAllCardImages() {
  if (preloadPromise) return preloadPromise;
  preloadStarted = true;
  const ids = _allImageIds();
  preloadPromise = Promise.all(ids.map((id) => _loadOne(id))).then((results) => {
    const loaded = results.filter((r) => r.ok).length;
    const failed = results.length - loaded;
    const stat = { total: results.length, loaded, failed };
    console.log('[CardRenderer] preload done:', stat);
    if (typeof preloadResolve === 'function') preloadResolve(stat);
    return stat;
  });
  return preloadPromise;
}

export function isPreloadDone() {
  return preloadPromise && imageState.size >= _allImageIds().length &&
    Array.from(imageState.values()).every((s) => s !== LOAD_STATE.PENDING);
}

export function getPreloadStats() {
  const values = Array.from(imageState.values());
  return {
    total: _allImageIds().length,
    loaded: values.filter((s) => s === LOAD_STATE.LOADED).length,
    failed: values.filter((s) => s === LOAD_STATE.FAILED).length,
    pending: values.filter((s) => s === LOAD_STATE.PENDING).length,
    started: preloadStarted,
  };
}

// ==================== hotfix 通用工具 ====================

/**
 * 绘制卡片基底：浅米白圆角背景 + 深灰细描边
 * 所有分支（正面图片 / 背面图片 / 手绘降级正面 / 手绘降级背面）都先调用这个
 */
function _drawCardBase(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = CARD_BASE_COLOR;
  roundRect(ctx, x, y, w, h, CARD_CORNER_RADIUS);
  ctx.fill();
  ctx.restore();
}

/**
 * 在 base 之后绘制外框描边（放在最后，确保盖在图片上层保留描边效果）
 */
function _drawCardStroke(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = CARD_STROKE_COLOR;
  ctx.lineWidth = CARD_STROKE_WIDTH;
  // 内缩半个 lineWidth 让描边不被裁切
  const half = CARD_STROKE_WIDTH / 2;
  roundRect(ctx, x + half, y + half, w - CARD_STROKE_WIDTH, h - CARD_STROKE_WIDTH, CARD_CORNER_RADIUS);
  ctx.stroke();
  ctx.restore();
}

/**
 * 15% 内缩后的图片绘制目标矩形
 */
function _insetRect(x, y, w, h) {
  const padX = w * CARD_INSET_RATIO;
  const padY = h * CARD_INSET_RATIO;
  return {
    x: x + padX,
    y: y + padY,
    w: w - 2 * padX,
    h: h - 2 * padY,
  };
}

// ==================== 手绘降级实现（保留自 INPUT-01，风格向 hotfix 对齐） ====================

function _suitColor(card) {
  if (card.isJoker) return JOKER_GOLD;
  return card.isRed ? RED_COLOR : BLACK_COLOR;
}

/**
 * 手绘背面（图片加载失败时使用）
 * hotfix：基底改为浅米白 + 圆角 + 深灰描边；蓝色斜纹作为装饰画在内缩区域，四周留白
 */
function _fallbackDrawBack(ctx, x, y, w, h) {
  // 1. 卡面基底
  _drawCardBase(ctx, x, y, w, h);

  // 2. 内缩区域画背面纹样（保留 INPUT-01 蓝色斜纹但缩小到内缩区）
  const inner = _insetRect(x, y, w, h);
  ctx.save();
  // clip 到内缩圆角矩形
  ctx.beginPath();
  roundRect(ctx, inner.x, inner.y, inner.w, inner.h, Math.max(CARD_CORNER_RADIUS - 4, 4));
  ctx.clip();

  ctx.fillStyle = CARD_BACK_BG;
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);

  ctx.strokeStyle = CARD_BACK_STRIPE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const step = 10;
  for (let i = -inner.h; i < inner.w; i += step) {
    ctx.moveTo(inner.x + i, inner.y);
    ctx.lineTo(inner.x + i + inner.h, inner.y + inner.h);
  }
  for (let i = 0; i < inner.w + inner.h; i += step) {
    ctx.moveTo(inner.x + i, inner.y);
    ctx.lineTo(inner.x + i - inner.h, inner.y + inner.h);
  }
  ctx.stroke();

  // 内缩区中心菱形
  const cx = inner.x + inner.w / 2;
  const cy = inner.y + inner.h / 2;
  const d = Math.min(inner.w, inner.h) * 0.12;
  ctx.fillStyle = '#F5D400';
  ctx.beginPath();
  ctx.moveTo(cx, cy - d);
  ctx.lineTo(cx + d * 0.8, cy);
  ctx.lineTo(cx, cy + d);
  ctx.lineTo(cx - d * 0.8, cy);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // 3. 外框描边
  _drawCardStroke(ctx, x, y, w, h);
}

/**
 * 手绘正面（图片加载失败时使用）
 * hotfix：基底改为浅米白 + 圆角 + 深灰描边；文字位置沿用相对比例
 */
function _fallbackDrawFront(ctx, x, y, w, h, card) {
  _drawCardBase(ctx, x, y, w, h);

  const color = _suitColor(card);
  ctx.save();
  ctx.fillStyle = color;

  if (card.isJoker) {
    ctx.font = `bold ${Math.floor(h * 0.18)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.displayRank, x + w / 2, y + h / 2);
    ctx.font = `bold ${Math.floor(h * 0.08)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('JOKER', x + w * 0.08, y + h * 0.06);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('JOKER', x + w - w * 0.08, y + h - h * 0.06);
  } else {
    const rankText = card.rank;
    const suitSym = SUIT_SYMBOL[card.suit] || '';
    const smallFontR = Math.floor(h * 0.13);
    const smallFontS = Math.floor(h * 0.11);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${smallFontR}px sans-serif`;
    ctx.fillText(rankText, x + w * 0.08, y + h * 0.06);
    ctx.font = `${smallFontS}px sans-serif`;
    ctx.fillText(suitSym, x + w * 0.08, y + h * 0.06 + smallFontR + 2);
    // 右下镜像
    ctx.save();
    ctx.translate(x + w - w * 0.08, y + h - h * 0.06);
    ctx.rotate(Math.PI);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${smallFontR}px sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(rankText, 0, 0);
    ctx.font = `${smallFontS}px sans-serif`;
    ctx.fillText(suitSym, 0, smallFontR + 2);
    ctx.restore();
    // 中央大花色
    ctx.font = `bold ${Math.floor(h * 0.4)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(suitSym, x + w / 2, y + h / 2);
  }
  ctx.restore();

  // 描边最后画，确保覆盖内容边缘
  _drawCardStroke(ctx, x, y, w, h);
}

/**
 * 使用图片绘制正面或背面：先画基底 → 内缩 15% 绘制图片 → 外框描边
 * @param {HTMLImageElement|Object} img
 */
function _drawImageCard(ctx, x, y, w, h, img) {
  // 1. 卡面基底（浅米白 + 圆角）
  _drawCardBase(ctx, x, y, w, h);

  // 2. 图片内缩 15% 居中绘制
  const inner = _insetRect(x, y, w, h);
  ctx.save();
  try {
    ctx.drawImage(img, inner.x, inner.y, inner.w, inner.h);
  } catch (e) {
    // drawImage 异常 → 交给上层降级
    ctx.restore();
    throw e;
  }
  ctx.restore();

  // 3. 外框描边（画在最上层，确保描边线可见）
  _drawCardStroke(ctx, x, y, w, h);
}

// ==================== 对外统一入口 ====================

/**
 * 绘制单张牌（支持翻转进度）
 * flip = 0 完全反面，flip = 1 完全正面
 * 无论正面 / 背面 / 图片 / 手绘降级，都统一：圆角浅米白底 + 15% 内缩图片 + 深灰细描边
 */
export function drawCard(ctx, pos, card, flip = 0) {
  const { x, y, w, h } = pos;
  const scaleX = Math.abs(flip - 0.5) * 2;
  const showFront = flip >= 0.5;

  const id = showFront && card ? card.id : 'back';
  const img = imageCache.get(id);

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(scaleX || 0.01, 1);
  ctx.translate(-(x + w / 2), -(y + h / 2));

  if (img && imageState.get(id) === LOAD_STATE.LOADED) {
    try {
      _drawImageCard(ctx, x, y, w, h, img);
    } catch (e) {
      console.warn('[CardRenderer] drawImage failed, fallback:', id, e);
      if (showFront && card) _fallbackDrawFront(ctx, x, y, w, h, card);
      else _fallbackDrawBack(ctx, x, y, w, h);
    }
  } else {
    if (showFront && card) _fallbackDrawFront(ctx, x, y, w, h, card);
    else _fallbackDrawBack(ctx, x, y, w, h);
  }
  ctx.restore();
}

export default {
  drawCard,
  preloadAllCardImages,
  isPreloadDone,
  getPreloadStats,
};
