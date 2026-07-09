// m24 - Components.js
// 通用 UI 组件工具函数：按钮绘制、命中测试、圆角矩形

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawButton(ctx, btn) {
  ctx.fillStyle = btn.bg || '#4C6EF5';
  roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 12);
  ctx.fill();
  ctx.fillStyle = btn.fg || '#FFFFFF';
  ctx.font = btn.font || 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2);
}

export function hitTest(touch, rect) {
  return (
    touch.clientX >= rect.x &&
    touch.clientX <= rect.x + rect.w &&
    touch.clientY >= rect.y &&
    touch.clientY <= rect.y + rect.h
  );
}
