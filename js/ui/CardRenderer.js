// m24 - CardRenderer.js
// INPUT-01.1：改造为图片渲染优先 + Canvas 手绘降级
// INPUT-01.1 hotfix：卡面浅米白底 + 圆角深灰细描边（保留）
// INPUT-01.1 hotfix2：正面图片 100% 充满；牌背图片路径回到 hayeah back.png（灰白网纹）
// INPUT-01.1 hotfix3：
//   - 正面图片改为 95% 充满（四周 2.5% 留白，`CARD_FRONT_INSET_RATIO`）
//   - **禁用 hayeah back.png 图片路径**：preload 跳过 back，_drawBack 直接走手绘蓝斜纹（INPUT-01 风格）
//   - back.png 文件本身保留在 images/cards/ 下，不删除素材
// 图片来源：hayeah/playing-cards-assets (MIT License) — 见 images/cards/LICENSE
// 命名约定：{suit}-{rank}.png / joker-big.png / joker-small.png / (back.png 已停用)

import { roundRect } from './Components';

const CARD_BASE_PATH = 'images/cards/';

// hotfix 视觉常量（保留：底色 + 描边色 + 描边宽度 + 圆角半径）
const CARD_BASE_COLOR = '#FFFEF5';   // 浅米白（Bug1 修复，保留）
const CARD_STROKE_COLOR = '#333333'; // 深灰细描边（保留）
const CARD_STROKE_WIDTH = 1;
const CARD_CORNER_RADIUS = 10;       // 8~10 DP，取 10 让 120×170 卡稍有质感

// hotfix3 视觉常量
const CARD_FRONT_INSET_RATIO = 0.025;  // 正面图片两侧各 2.5% 留白 → 95% 充满

// 手绘用色（牌背蓝色斜纹 = INPUT-01 原风格，hotfix3 起牌背固定手绘）
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
 * 收集需要预加载的图片 id
 * hotfix3：**跳过 back**，牌背固定手绘 —— 避免灰白 back.png 加载完成后覆盖蓝斜纹
 */
function _allImageIds() {
  const ids = [];
  const suits = ['spade', 'heart', 'diamond', 'club'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  for (const s of suits) for (const r of ranks) ids.push(`${s}-${r}`);
  ids.push('joker-big');
  ids.push('joker-small');
  // 注意：hotfix3 不再 push 'back'，即 preloadAllCardImages 也不会去加载它
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
 * 预加载全部正面 54 张扑克素材（不含 back）
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
 * 绘制卡片基底：浅米白圆角背景
 * 所有分支（正面图片 / 手绘背面 / 手绘降级正面）都先调用
 */
function _drawCardBase(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = CARD_BASE_COLOR;
  roundRect(ctx, x, y, w, h, CARD_CORNER_RADIUS);
  ctx.fill();
  ctx.restore();
}

/**
 * 外框描边（放在最后，确保盖在内容上层保留描边效果）
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

// ==================== 手绘实现 ====================

function _suitColor(card) {
  if (card.isJoker) return JOKER_GOLD;
  return card.isRed ? RED_COLOR : BLACK_COLOR;
}

/**
 * 手绘背面（INPUT-01 蓝色斜纹 + 黄色中央菱形）
 * hotfix3：牌背固定走此路径（不再有图片分支），并保留 hotfix 底色/圆角/描边
 */
function _fallbackDrawBack(ctx, x, y, w, h) {
  // 1. 卡面基底（浅米白 + 圆角） —— R3 保留
  _drawCardBase(ctx, x, y, w, h);

  // 2. INPUT-01 手绘蓝色斜纹铺满卡面（clip 到圆角，避免溢出圆角外）
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, CARD_CORNER_RADIUS);
  ctx.clip();

  ctx.fillStyle = CARD_BACK_BG;
  ctx.fillRect(x, y, w, h);

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

  // 中央黄色菱形
  const cx = x + w / 2;
  const cy = y + h / 2;
  const d = Math.min(w, h) * 0.1;
  ctx.fillStyle = '#F5D400';
  ctx.beginPath();
  ctx.moveTo(cx, cy - d);
  ctx.lineTo(cx + d * 0.8, cy);
  ctx.lineTo(cx, cy + d);
  ctx.lineTo(cx - d * 0.8, cy);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // 3. 外框描边（R3 保留）
  _drawCardStroke(ctx, x, y, w, h);
}

/**
 * 手绘正面（图片加载失败时使用；正常路径走 _drawImageCard）
 * 外层保留 hotfix 浅米白底 + 圆角 + 深灰描边
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

  // 描边最后画，确保覆盖内容边缘
  _drawCardStroke(ctx, x, y, w, h);
}

/**
 * 使用图片绘制正面：底色 → 95% 充满绘制图片 → 外框描边
 * hotfix3：正面从 100% 缩回 95%（`CARD_FRONT_INSET_RATIO = 0.025` 两侧各 2.5%）
 * @param {HTMLImageElement|Object} img
 */
function _drawImageCard(ctx, x, y, w, h, img) {
  // 1. 卡面基底（浅米白 + 圆角） —— 图片若有透明区可透出米白
  _drawCardBase(ctx, x, y, w, h);

  // 2. 图片 95% 铺满（hotfix3 微调）
  ctx.save();
  try {
    const padX = w * CARD_FRONT_INSET_RATIO;
    const padY = h * CARD_FRONT_INSET_RATIO;
    ctx.drawImage(img, x + padX, y + padY, w - 2 * padX, h - 2 * padY);
  } catch (e) {
    ctx.restore();
    throw e;
  }
  ctx.restore();

  // 3. 外框描边
  _drawCardStroke(ctx, x, y, w, h);
}

// ==================== 对外统一入口 ====================

/**
 * 绘制单张牌（支持翻转进度）
 * flip = 0 完全反面，flip = 1 完全正面
 * hotfix3：
 *   - 正面：图片 95% 充满（若已加载）；否则手绘降级
 *   - 反面：**恒定走手绘蓝斜纹**（禁用 hayeah back.png 图片路径），避免 1~2 秒后被灰白图覆盖
 */
export function drawCard(ctx, pos, card, flip = 0) {
  const { x, y, w, h } = pos;
  const scaleX = Math.abs(flip - 0.5) * 2;
  const showFront = flip >= 0.5;

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(scaleX || 0.01, 1);
  ctx.translate(-(x + w / 2), -(y + h / 2));

  if (showFront && card) {
    // 正面：优先图片，否则降级手绘
    const id = card.id;
    const img = imageCache.get(id);
    if (img && imageState.get(id) === LOAD_STATE.LOADED) {
      try {
        _drawImageCard(ctx, x, y, w, h, img);
      } catch (e) {
        console.warn('[CardRenderer] drawImage failed, fallback:', id, e);
        _fallbackDrawFront(ctx, x, y, w, h, card);
      }
    } else {
      _fallbackDrawFront(ctx, x, y, w, h, card);
    }
  } else {
    // 反面：hotfix3 起恒定走手绘蓝斜纹，不再读取 imageCache.get('back')
    _fallbackDrawBack(ctx, x, y, w, h);
  }

  ctx.restore();
}

export default {
  drawCard,
  preloadAllCardImages,
  isPreloadDone,
  getPreloadStats,
};
