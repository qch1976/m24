// m24 - Background.js
// 牌桌背景：Canvas 径向渐变绿色桌面 + 边缘阴影
// 备选素材方案（12-INPUT01-素材清单.md 4.1），不引入外部图片，确保版权合规

export default class Background {
  constructor(ctx, w, h) {
    this.ctx = ctx;
    this.w = w;
    this.h = h;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
  }

  render() {
    const { ctx, w, h } = this;
    // 径向渐变：中央亮绿 -> 边缘深绿
    const grad = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.1,
      w / 2, h / 2, Math.max(w, h) * 0.75
    );
    grad.addColorStop(0, '#2E8B57'); // 中心亮绿
    grad.addColorStop(0.7, '#1F5E3A');
    grad.addColorStop(1, '#0F3A21'); // 边缘深绿
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 桌面木质边框
    const borderW = 12;
    ctx.strokeStyle = '#6B3E1F';
    ctx.lineWidth = borderW;
    ctx.strokeRect(borderW / 2, borderW / 2, w - borderW, h - borderW);

    // 桌面标题
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('24 POINTS TABLE', w / 2, 42);
  }
}
