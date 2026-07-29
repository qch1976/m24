// m24 - SettingsButton.js
// INPUT-05：⚙️ 设置按钮（左上角 40×40 DP）
// 依据：106-INPUT05 §3.1/§3.2
//
// 坐标（设计尺寸 411×891）：x=[15,55] y=[15,55]
// 视觉：圆角 8DP 灰色半透明背景 rgba(200,200,200,0.6)，前景 #333，图标 "⚙"
// 热区扩展至 44×44 DP（按钮矩形本身 40×40）

import { roundRect } from './Components';

export const SETTINGS_BTN_ANCHOR = { x: 15, y: 15, w: 40, h: 40 };

const BG_COLOR = 'rgba(200,200,200,0.6)';
const FG_COLOR = '#333333';
const RADIUS = 8;
const ICON = '\u2699'; // ⚙

export function drawSettingsButton(ctx, rect, scale = 1) {
  ctx.save();
  ctx.fillStyle = BG_COLOR;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, RADIUS * scale);
  ctx.fill();
  ctx.fillStyle = FG_COLOR;
  ctx.font = `${Math.floor(22 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ICON, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1 * scale);
  ctx.restore();
}

// 命中区：扩展至 44×44 DP（膨出 2 DP，缩放后同步膨出）
export function hitSettingsButton(touch, rect, scale = 1) {
  const pad = 2 * scale;
  return (
    touch.clientX >= rect.x - pad &&
    touch.clientX <= rect.x + rect.w + pad &&
    touch.clientY >= rect.y - pad &&
    touch.clientY <= rect.y + rect.h + pad
  );
}

export default { drawSettingsButton, hitSettingsButton, SETTINGS_BTN_ANCHOR };
