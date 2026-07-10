// m24 - ButtonRenderer.js
// 发牌按钮及通用按钮渲染
import { roundRect } from './Components';

const DEFAULT_BG = '#E63946';
const DEFAULT_BG_ACTIVE = '#B71E2C';
const DEFAULT_FG = '#FFFFFF';

export function drawDealButton(ctx, btn) {
  const { x, y, w, h, pressed, disabled, text } = btn;
  ctx.save();
  ctx.fillStyle = disabled ? '#8A8A8A' : pressed ? DEFAULT_BG_ACTIVE : DEFAULT_BG;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  // 高光
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, 'rgba(255,255,255,0.35)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  // 文字
  ctx.fillStyle = DEFAULT_FG;
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text || '发牌', x + w / 2, y + h / 2);
  ctx.restore();
}

export default {
  drawDealButton,
};
