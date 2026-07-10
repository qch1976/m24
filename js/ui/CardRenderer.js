// m24 - CardRenderer.js
// INPUT-01.1：改造为图片渲染优先 + Canvas 手绘降级
// 图片来源：hayeah/playing-cards-assets (MIT License) — 见 images/cards/LICENSE
// 命名约定：{suit}-{rank}.png / joker-big.png / joker-small.png / back.png
// 保留 INPUT-01 的手绘实现作为图片加载失败时的兜底，确保游戏可跑

import { roundRect } from './Components';

const CARD_BASE_PATH = 'images/cards/';
const CARD_BG = '#FFFFFF';
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

/**
 * 收集全部 55 张需要预加载的图片 id
 */
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
 * @returns {Promise<{loaded:number, failed:number, total:number}>}
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

// ==================== 手绘降级实现（保留自 INPUT-01） ====================

function _suitColor(card) {
  if (card.isJoker) return JOKER_GOLD;
  return card.isRed ? RED_COLOR : BLACK_COLOR;
}

function _fallbackDrawBack(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = CARD_BACK_BG;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 8);
  ctx.clip();
  ctx.strokeStyle = CARD_BACK_STRIPE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const step = 10;
  for (let i = -h; i < w; i += step) {
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + h, y + h);
  }
  for (let i = 0; i < w + h; i += step) {
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i - h, y + h);
  }
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#0F1E4B';
  ctx.lineWidth = 2;
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 7);
  ctx.stroke();
  ctx.fillStyle = '#F5D400';
  const cx = x + w / 2;
  const cy = y + h / 2;
  const d = Math.min(w, h) * 0.1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - d);
  ctx.lineTo(cx + d * 0.8, cy);
  ctx.lineTo(cx, cy + d);
  ctx.lineTo(cx - d * 0.8, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function _fallbackDrawFront(ctx, x, y, w, h, card) {
  ctx.save();
  ctx.fillStyle = CARD_BG;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = '#B0B0B0';
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 8);
  ctx.stroke();

  const color = _suitColor(card);
  ctx.fillStyle = color;

  if (card.isJoker) {
    ctx.font = `bold ${Math.floor(h * 0.18)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.displayRank, x + w / 2, y + h / 2);
    ctx.font = `bold ${Math.floor(h * 0.08)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('JOKER', x + w * 0.06, y + h * 0.05);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('JOKER', x + w - w * 0.06, y + h - h * 0.05);
  } else {
    const rankText = card.rank;
    const suitSym = SUIT_SYMBOL[card.suit] || '';
    const smallFontR = Math.floor(h * 0.13);
    const smallFontS = Math.floor(h * 0.11);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${smallFontR}px sans-serif`;
    ctx.fillText(rankText, x + w * 0.06, y + h * 0.05);
    ctx.font = `${smallFontS}px sans-serif`;
    ctx.fillText(suitSym, x + w * 0.06, y + h * 0.05 + smallFontR + 2);
    // 右下镜像
    ctx.save();
    ctx.translate(x + w - w * 0.06, y + h - h * 0.05);
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
}

// ==================== 对外统一入口 ====================

/**
 * 绘制单张牌（支持翻转进度）
 * flip = 0 完全反面，flip = 1 完全正面
 * 图片可用时使用 drawImage；否则走降级方案
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
    // 图片渲染
    try {
      ctx.drawImage(img, x, y, w, h);
    } catch (e) {
      console.warn('[CardRenderer] drawImage failed, fallback:', id, e);
      if (showFront && card) _fallbackDrawFront(ctx, x, y, w, h, card);
      else _fallbackDrawBack(ctx, x, y, w, h);
    }
  } else {
    // 降级：Canvas 手绘
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
