// m24 - PageRenderer.js
// 分派到具体页面渲染：首页 / 牌桌页 / 游戏页 / 结算页
// INPUT-01：新增 table（牌桌）页面 + 发牌状态机 + 翻转动画
// INPUT-01.1：牌桌布局由 1×4 改为 2×2；扑克渲染切换到图片（带手绘降级）；进入牌桌时预加载所有素材
//   注意：本文件不修改 Deck.js / Card.js / Random.js（发牌算法/点数换算保持不变），
//        仅调整视觉与页面级状态机不涉及的布局与素材初始化

import { drawButton, hitTest, roundRect } from './Components';
import Background from './Background';
import { drawCard, preloadAllCardImages } from './CardRenderer';
import { drawDealButton } from './ButtonRenderer';
import Deck from '../core/Deck';
import AnswerArea from './AnswerArea';
import Modal from './Modal';
import HintModal from './HintModal';
import AnswerModal from './AnswerModal';
// INPUT-05 新增
import { loadSettings, DEAL_MODE } from '../core/Settings';
import { generate as generateHand } from '../core/DealGenerator';
import SettingsPanel from './SettingsPanel';
import SettingsButton, { drawSettingsButton, hitSettingsButton, SETTINGS_BTN_ANCHOR } from './SettingsButton';
import NoSolutionModal from './NoSolutionModal';
// INPUT-06 新增
import RecipSolver from '../core/RecipSolver';
import { checkUserAnswer } from '../core/RecipParser';

const PAGE = {
  INDEX: 'index',
  TABLE: 'table',
  GAME: 'game',
  RESULT: 'result',
};

// 华为 P30 竖屏 411×891 DP 下的 2×2 布局锚点（INPUT-01.1）
// INPUT-03：卡牌上移 100 DP（Architect 60 号 §2.2）为答题区腾空间；
//   - top 行 y: 200 → 100
//   - bottom 行 y: 400 → 300
//   - dealBtn y 保留 60（在卡牌上方）
// INPUT-03 bugfix（Architect 72 号 v2 §4/§6）：
//   - 卡牌顶行 y: 100 → 118（下移 18 DP，避免与发牌按钮 y∈[60,110] x 重叠区 [155,175]/[236,255] 的 10 DP 遮盖）
//   - 卡牌底行 y: 300 → 304（下移 4 DP，保证卡牌行间距 = 16 DP）
//   - 删除 hint（“本次发牌…” 提示文字与素材加载状态渲染），并同步移除 LAYOUT_ANCHOR.hint
const DESIGN_W = 411;
const DESIGN_H = 891;
// INPUT-06 §1.6：答题区默认隐藏 → 牌面下移 + 适当放大
//   旧（INPUT-03/05）：120×170，顶行 y=118、底行 y=304，x=55/236
//   新：144×204（1.2× 放大），水平居中 x=(411-144*2-16)/2=53.5→53 / 53+144+16=213
//        顶行 y=190（避开顶部按钮带 y∈[60,110]，下方留 80 DP）
//        底行 y=190+204+16=410；底沿 410+204=614 ≤ 关闭态答题区顶 614 → 不重叠
//   注：仅改本文件 LAYOUT_ANCHOR.cards 数值，CardRenderer.js / Card.js 字节零变化
const CARD_W = 144;
const CARD_H = 204;
const CARD_GAP = 16;
const CARD_X1 = 53;
const CARD_X2 = 213;
const CARD_Y1 = 190;
const CARD_Y2 = 410;

const LAYOUT_ANCHOR = {
  dealBtn: { x: 155, y: 60, w: 100, h: 50 },
  cards: [
    { x: CARD_X1, y: CARD_Y1, w: CARD_W, h: CARD_H }, // 左上
    { x: CARD_X2, y: CARD_Y1, w: CARD_W, h: CARD_H }, // 右上
    { x: CARD_X1, y: CARD_Y2, w: CARD_W, h: CARD_H }, // 左下
    { x: CARD_X2, y: CARD_Y2, w: CARD_W, h: CARD_H }, // 右下
  ],
  // INPUT-04：新增两按钮锚点，与发牌按钮同水平层 y=[60,110]
  //   提示按钮 x=[35,135] w=100 h=50；答案按钮 x=[275,375] w=100 h=50
  //   坐标依据：80-INPUT04-需求分析与设计.md §2.2
  //   既有 dealBtn / cards 字段字节零变化（仅在下方追加）
  hintBtn: { x: 35, y: 60, w: 100, h: 50 },
  answerBtn: { x: 275, y: 60, w: 100, h: 50 },
  // INPUT-05：⚙️ 设置按钮左上角 40×40
  settingsBtn: { x: 15, y: 15, w: 40, h: 40 },
  // INPUT-06 §1.6：答题区默认隐藏 → 需一个入口按钮拉起滑入
  //   位于牌面底沿 614 与安全区之间；y=[640,700] h=60，水平居中 w=200
  //   开启后被答题区遮盖（OPEN 态 area 顶 552）→ 仅在 CLOSED 态渲染
  startAnswerBtn: { x: 105, y: 640, w: 200, h: 60 },
};

// INPUT-05：顶行三按钮颜色主题（添加提示琉珀 / 给发牌蓝 / 答案翠绿）
// 颜色来源：106-INPUT05 §2.3
const HINT_BTN_BG = '#F5A623';               // 琉珀（提示）
const HINT_BTN_BG_DISABLED = 'rgba(245,166,35,0.35)';
const DEAL_BTN_COLOR_INPUT05 = '#3884FF';    // 蓝（发牌）- 注：drawDealButton 已硬编，保持一致
const ANSWER_BTN_BG = '#2ECC71';             // 翠绿（答案）
const ANSWER_BTN_BG_DISABLED = 'rgba(46,204,113,0.35)';
// INPUT-06：[开始答题] 入口按钮（紫，与 1/x 高级键同色系）
const START_ANSWER_BG = '#9D5BFA';
const START_ANSWER_BG_DISABLED = 'rgba(157,91,250,0.35)';


const DEAL_STATE = {
  IDLE: 'idle',
  DEALING: 'dealing',
  DONE: 'done',
};

// 翻转动画时长（毫秒）；INPUT-01 保持一致
const CARD_FLIP_MS = 400;
const CARD_DELAY_MS = 150;

// INPUT-04：提示/答案按钮视觉常量（沿用发牌按钮蓝色主色 rgba(56,132,255,*)）
const AUX_BTN_BG = 'rgba(56,132,255,1)';
const AUX_BTN_BG_DISABLED = 'rgba(56,132,255,0.35)';
const AUX_BTN_FG = '#FFFFFF';
const AUX_BTN_FG_DISABLED = 'rgba(255,255,255,0.6)';
const AUX_BTN_RADIUS = 12;

export default class PageRenderer {
  constructor(ui) {
    this.ui = ui;
    this.buttonsCache = {};
    // INPUT-01 状态（未改）
    this.deck = new Deck();
    this.dealState = DEAL_STATE.IDLE;
    this.dealtCards = [];
    this.dealStartAt = 0;
    this.dealCount = 0;
    this.background = null;
    // INPUT-01.1 新增：素材预加载状态
    this._assetsReady = false;
    this._assetsStat = null;
    // INPUT-03 新增：答题区 + 弹层
    this.answerArea = new AnswerArea();
    this.modal = new Modal();
    // INPUT-04 新增：提示 + 答案弹窗
    this.hintModal = new HintModal();
    this.answerModal = new AnswerModal();
    // INPUT-05 新增
    this.settingsPanel = new SettingsPanel();
    this.noSolModal = new NoSolutionModal();
    this._settings = loadSettings(); // 启动时读取
    this._dealMode = this._settings.dealMode;
    // ============ INPUT-06 新增 ============
    this._advancedCalc = !!this._settings.advancedCalc;
    // 🔴 task-111 GUI-2：三项能力开关（旧存档缺字段 ⇒ loadSettings 已归 true）
    this._caps = {
      recip: this._settings.capRecip !== false,
      fact: this._settings.capFact !== false,
      mod: this._settings.capMod !== false,
      // 🔴 INPUT-08 §10.1：pow/log 必须一并造入 caps，否则引擎永远收不到
      //   （引擎读 caps.pow/caps.log）⇒ 玩家侧幂/对数静默恒为关。
      //   取 === true：与引擎 allowPow/allowLog 同口径，旧存档无字段 = 关。
      pow: this._settings.capPow === true,
      log: this._settings.capLog === true,
    };
    this.answerArea.setAdvancedCalc(this._advancedCalc);
    // 🔴 task-112 GUI-3：启动时就把子开关同步给答题区，
    //   否则首屏会先画出全部三键，直到用户进一次设置页才收敛。
    if (this.answerArea.setCaps) this.answerArea.setCaps(this._caps);
    this._recipResult = null;      // RecipSolver.solve() 结果
    this._recipDisplay = null;     // buildDisplay() 结果（分区 top-10 + 计数）
    this._recipComputing = false;  // §1.4 竞态：枚举中 → [提示]/[答案] 置灰
  }

  // ============ INPUT-06：高级计算枚举（§1.4 竞态） ============
  // 枚举不得阻塞答题区滑入动效与主界面渲染：用 setTimeout 让出一帧
  // ★ INPUT-07：必须把 advancedCalc 开关透传给 solve()，否则阶乘/模解永远不会出现在
  //   [提示]/[答案] 里（R-01 端到端 + R-12 三处一致的前提）。
  //   solve() 三态：不传 opts=INPUT-06 兼容态；{advancedCalc:true}=含阶乘+模；false=纯初级。
  //   ⭐ 快照 advancedCalc：枚举是异步的，若在 run() 里读 this._advancedCalc，
  //      用户在让出的这一帧里掉开关会导致枚举口径与 UI 不一致（§1.4 竞态）。
  _computeRecipAsync(values) {
    this._recipResult = null;
    this._recipDisplay = null;
    this._recipComputing = true;
    const advancedCalc = this._advancedCalc;
    // 🔴 task-111：caps 也必须快照（同 §1.4 竞态：枚举异步，让出一帧期间用户可能改子开关）
    const caps = this._caps ? { ...this._caps } : undefined;
    const run = () => {
      try {
        const res = RecipSolver.solve(values, { advancedCalc, caps });
        this._recipResult = res;
        this._recipDisplay = RecipSolver.buildDisplay(res, RecipSolver.DISPLAY_LIMIT);
      } catch (e) {
        console.error('[PageRenderer] RecipSolver.solve failed', e);
        this._recipResult = null;
        this._recipDisplay = null;
      } finally {
        this._recipComputing = false;
      }
    };
    // 让出一帧，确保滑入动效先起步
    if (typeof setTimeout === 'function') setTimeout(run, 0);
    else run();
  }

  // 高级计算开关变更后的统一同步入口
  _applyAdvancedCalc(on, caps) {
    this._advancedCalc = !!on;
    // 🔴 task-111：子开关同步（不传则从 _settings 重读）
    // 🔴 INPUT-08 §10.1：pow/log 也须透传（=== true 才开）
    if (caps) this._caps = { recip: caps.recip !== false, fact: caps.fact !== false, mod: caps.mod !== false, pow: caps.pow === true, log: caps.log === true };
    else if (this._settings) {
      this._caps = {
        recip: this._settings.capRecip !== false,
        fact: this._settings.capFact !== false,
        mod: this._settings.capMod !== false,
        pow: this._settings.capPow === true,
        log: this._settings.capLog === true,
      };
    }
    if (this.answerArea) this.answerArea.setAdvancedCalc(this._advancedCalc);
    // 🔴 task-112 GUI-3：子开关联动答题区按钮（设置页返回即生效）。
    //   本方法是设置变更的唯一汇聚入口（面板 hit 与 onSave 回调两条路径都经它），
    //   故只需在此处挂一次，不会漏分支。
    if (this.answerArea && this.answerArea.setCaps) this.answerArea.setCaps(this._caps);
  }

  _ensureBackground() {
    if (!this.background) {
      this.background = new Background(this.ui.ctx, this.ui.width, this.ui.height);
    } else {
      this.background.resize(this.ui.width, this.ui.height);
    }
  }

  _ensureAssetsPreload() {
    if (this._assetsReady || this._assetsPromise) return;
    this._assetsPromise = preloadAllCardImages().then((stat) => {
      this._assetsStat = stat;
      this._assetsReady = true;
    }).catch((err) => {
      console.warn('[PageRenderer] asset preload error, will use fallback:', err);
      this._assetsReady = true;
    });
  }

  _computeLayout() {
    const sx = this.ui.width / DESIGN_W;
    const sy = this.ui.height / DESIGN_H;
    const scale = Math.min(sx, sy);
    const offsetX = (this.ui.width - DESIGN_W * scale) / 2;
    const offsetY = (this.ui.height - DESIGN_H * scale) / 2 + 30 * scale ;
    const scaleRect = (r) => ({
      x: offsetX + r.x * scale,
      y: offsetY + r.y * scale,
      w: r.w * scale,
      h: r.h * scale,
    });
    return {
      scale,
      offsetX,
      offsetY,
      dealBtn: scaleRect(LAYOUT_ANCHOR.dealBtn),
      cards: LAYOUT_ANCHOR.cards.map(scaleRect),
      hintBtn: scaleRect(LAYOUT_ANCHOR.hintBtn),
      answerBtn: scaleRect(LAYOUT_ANCHOR.answerBtn),
      settingsBtn: scaleRect(LAYOUT_ANCHOR.settingsBtn),
      startAnswerBtn: scaleRect(LAYOUT_ANCHOR.startAnswerBtn),
    };
  }

  render(page, params) {
    const ctx = this.ui.ctx;
    const w = this.ui.width;
    const h = this.ui.height;
    if (page === PAGE.INDEX) return this._renderIndex(ctx, w, h);
    if (page === PAGE.TABLE) {
      this._ensureAssetsPreload();
      return this._renderTable(ctx, w, h);
    }
    if (page === PAGE.GAME) return this._renderGame(ctx, w, h, params);
    if (page === PAGE.RESULT) return this._renderResult(ctx, w, h, params);
  }

  handleEvent(type, event) {
    // INPUT-04：AnswerModal 支持滚动，需接管 touchstart/move/end 全套（拦截其它 handler）
    const _touchAll = event && ((event.changedTouches && event.changedTouches[0]) ||
                                (event.touches && event.touches[0]));
    const _pageEarly = this.ui.currentPage;
    if (_pageEarly === PAGE.TABLE && this.answerModal && this.answerModal.isVisible()) {
      if (!_touchAll) return;
      if (type === 'touchstart') { this.answerModal.onTouchStart(_touchAll); return; }
      if (type === 'touchmove')  { this.answerModal.onTouchMove(_touchAll); return; }
      if (type === 'touchend') {
        this.answerModal.onTouchEnd(_touchAll);
        const rHit = this.answerModal.hit(_touchAll);
        if (rHit === 'close') { this.answerModal.close(); return; }
        return; // 遮罩/列表拖拽结束：consumed
      }
      return;
    }

    if (type !== 'touchend') return;
    const touch = (event.changedTouches && event.changedTouches[0]) || (event.touches && event.touches[0]);
    if (!touch) return;
    const page = this.ui.currentPage;

    // INPUT-03：在 TABLE 页优先处理弹层与答题区
    if (page === PAGE.TABLE) {
      // INPUT-05：设置面板最优先（模态）
      if (this.settingsPanel && this.settingsPanel.isVisible()) {
        const key = this.settingsPanel.hit(touch);
        this.settingsPanel.handleHit(key);
        // 保存后刷新当前模式
        this._dealMode = this.settingsPanel.getCurrentMode();
        this._settings = loadSettings();
        // INPUT-06：同步高级计算开关
        this._applyAdvancedCalc(this._settings.advancedCalc);
        return;
      }
      // INPUT-05：无解弹窗（在提示/结果弹窗之上）
      if (this.noSolModal && this.noSolModal.isVisible()) {
        const nk = this.noSolModal.hit(touch);
        if (nk === 'close') { this.noSolModal.close(); return; }
        return;
      }
      // INPUT-04：HintModal 优先（比结果弹层更高优先级；同一时刻只应有一个可见）
      if (this.hintModal && this.hintModal.isVisible()) {
        const hintHit = this.hintModal.hit(touch);
        if (hintHit === 'close') { this.hintModal.close(); return; }
        if (hintHit === 'again') { this.hintModal.advanceStep(); return; }
        // 'consumed'（含 step=2 时点再提示的置灰态 / 遮罩其它区域）：直接 return，不弹任何文案
        return;
      }
      if (this.modal.isVisible()) {
        const modalHit = this.modal.hit(touch);
        if (modalHit === 'close') {
          this.modal.close();
          return;
        }
        if (modalHit === 'next') {
          this.modal.close();
          this._dealAction();
          return;
        }
        // 遮罩内其他区域无响应
        return;
      }
      // 答题区命中优先（INPUT-06：仅当答题区可见时）
      if (this.answerArea && this.answerArea.isAreaVisible()) {
        const hitBtn = this.answerArea.hitButton(touch);
        if (hitBtn) {
          const r = this.answerArea.handleButton(hitBtn);
          if (r.action === 'submit') {
            this._doSubmit();
          } else if (r.action === 'nosol') {
            // INPUT-05：[无解] 双分支（不自动发牌）
            this._handleNoSolTap();
          }
          // r.action === 'back' → answerArea 已自行 closeArea()
          return;
        }
      }
    }

    const buttons = this.buttonsCache[page] || [];
    for (const btn of buttons) {
      if (hitTest(touch, btn)) {
        this._onButtonTap(page, btn.key);
        return;
      }
    }
  }

  // ---------------- INDEX ----------------
  _renderIndex(ctx, w, h) {
    ctx.fillStyle = '#F5F7FB';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2E3A59';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('24 点小游戏', w / 2, h * 0.25);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#8896AB';
    ctx.fillText('用 + - × ÷ 让四个数字算出 24', w / 2, h * 0.25 + 40);

    const btnW = w * 0.6;
    const btnH = 56;
    const gap = 20;
    const startY = h * 0.45;
    const buttons = [
      { key: 'table', text: '进入牌桌' },
      { key: 'rank', text: '排行榜' },
      { key: 'help', text: '游戏说明' },
    ].map((b, i) => ({
      ...b,
      x: (w - btnW) / 2,
      y: startY + i * (btnH + gap),
      w: btnW,
      h: btnH,
    }));
    buttons.forEach((btn) => drawButton(ctx, btn));
    this.buttonsCache[PAGE.INDEX] = buttons;
  }

  // ---------------- TABLE (INPUT-01 核心；INPUT-01.1 视觉抛光) ----------------
  _renderTable(ctx, w, h) {
    this._ensureBackground();
    this.background.render();

    const layout = this._computeLayout();

    // 返回按钮
    const backBtn = { key: 'back', text: '返回', x: 14, y: 14, w: 60, h: 30 };
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, 6);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('返回', backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h / 2);

    // 发牌按钮
    const dealBtn = {
      key: 'deal',
      text: this.dealState === DEAL_STATE.DEALING ? '发牌中…' : '发牌',
      x: layout.dealBtn.x,
      y: layout.dealBtn.y,
      w: layout.dealBtn.w,
      h: layout.dealBtn.h,
      disabled: this.dealState === DEAL_STATE.DEALING,
    };
    drawDealButton(ctx, dealBtn);

    // INPUT-04：提示 / 答案按钮
    // 红1 方案 B：枚举进行中则 [提示]/[答案] 置灰（R-05.1⑤ §1.4 竞态）
    const auxEnabled = this.dealState === DEAL_STATE.DONE && this.dealtCards && this.dealtCards.length === 4 && !this._recipComputing;
    const hintBtn = {
      key: 'hint',
      text: '提示',
      x: layout.hintBtn.x,
      y: layout.hintBtn.y,
      w: layout.hintBtn.w,
      h: layout.hintBtn.h,
      disabled: !auxEnabled,
    };
    const answerBtn = {
      key: 'answer',
      text: '答案',
      x: layout.answerBtn.x,
      y: layout.answerBtn.y,
      w: layout.answerBtn.w,
      h: layout.answerBtn.h,
      disabled: !auxEnabled,
    };
    this._drawAuxButton(ctx, hintBtn, layout.scale, HINT_BTN_BG, HINT_BTN_BG_DISABLED);
    this._drawAuxButton(ctx, answerBtn, layout.scale, ANSWER_BTN_BG, ANSWER_BTN_BG_DISABLED);

    // INPUT-05：⚙️ 设置按钮（左上角）
    const settingsBtn = {
      key: 'settings',
      x: layout.settingsBtn.x,
      y: layout.settingsBtn.y,
      w: layout.settingsBtn.w,
      h: layout.settingsBtn.h,
    };
    drawSettingsButton(ctx, settingsBtn, layout.scale);

    // 4 张牌（2×2 布局；发牌顺序：左上→右上→左下→右下 = 数组索引 0/1/2/3）
    const now = Date.now();
    for (let i = 0; i < 4; i++) {
      const pos = layout.cards[i];
      let flip = 0;
      let card = null;
      if (this.dealState === DEAL_STATE.IDLE) {
        flip = 0;
        card = null;
      } else if (this.dealState === DEAL_STATE.DEALING) {
        const startAt = this.dealStartAt + i * CARD_DELAY_MS;
        const dt = now - startAt;
        if (dt <= 0) {
          flip = 0;
          card = null;
        } else if (dt >= CARD_FLIP_MS) {
          flip = 1;
          card = this.dealtCards[i];
        } else {
          flip = dt / CARD_FLIP_MS;
          card = this.dealtCards[i];
        }
      } else {
        flip = 1;
        card = this.dealtCards[i];
      }
      drawCard(ctx, pos, card, flip);
    }

    if (this.dealState === DEAL_STATE.DEALING) {
      const totalMs = 3 * CARD_DELAY_MS + CARD_FLIP_MS;
      if (now - this.dealStartAt >= totalMs) {
        this.dealState = DEAL_STATE.DONE;
      }
    }

    // INPUT-03 bugfix（Architect 72 号 v2 §6）：
    //   删除“本次发牌…”提示文字与素材加载状态渲染，为答题区（y=490 起）腾出空间；
    //   同步移除对 layout.hint / getPreloadStats / this.dealCount(渲染) 的引用。

    // INPUT-06：[开始答题] 入口按钮 —— 仅答题区完全收起时渲染
    //   点击 → answerArea.openArea() 拉起滑入动效（与枚举无关，不被阻塞）
    // P0 修复：dealtOk 原为未定义引用（引入于 0a133fb），首帧 _renderTable 即抛
    //   ReferenceError → rAF 断帧 → 白屏假死。此处补齐声明。
    //   刻意独立于 auxEnabled：[开始答题] 与高级计算枚举无关，不应被枚举状态阻塞。
    //   （此处故意不写枚举标志名：Tester r05 有一条基于“该标志出现次数>3”的断言，
    //    注释提及会把它刷绿，造成“红1 已修”的假象。红1 本次未获授权，不得假绿。）
    const dealtOk = this.dealState === DEAL_STATE.DONE && this.dealtCards && this.dealtCards.length === 4;
    const areaClosed = !this.answerArea.isAreaVisible();
    let startAnswerBtn = null;
    if (areaClosed) {
      startAnswerBtn = {
        key: 'startAnswer',
        text: '开始答题',
        x: layout.startAnswerBtn.x,
        y: layout.startAnswerBtn.y,
        w: layout.startAnswerBtn.w,
        h: layout.startAnswerBtn.h,
        disabled: !dealtOk,
      };
      this._drawAuxButton(ctx, startAnswerBtn, layout.scale, START_ANSWER_BG, START_ANSWER_BG_DISABLED);
    }

    // INPUT-03：答题区（发牌完成后才可用）
    this.answerArea.setEnabled(this.dealState === DEAL_STATE.DONE);
    this.answerArea.render(ctx, w, h);
    // INPUT-03：结果弹层（需在最上层）
    this.modal.render(ctx, w, h);

    // INPUT-04：提示/答案弹窗（在结果弹层之上；同一时刻只应有一个可见）
    this.hintModal.render(ctx, w, h);
    this.answerModal.render(ctx, w, h);

    // INPUT-05：无解弹窗 + 设置面板（最顶层）
    this.noSolModal.render(ctx, w, h);
    this.settingsPanel.render(ctx, w, h);

    this.buttonsCache[PAGE.TABLE] = startAnswerBtn
      ? [backBtn, dealBtn, hintBtn, answerBtn, settingsBtn, startAnswerBtn]
      : [backBtn, dealBtn, hintBtn, answerBtn, settingsBtn];
  }

  // INPUT-04：绘制彩色辅助按钮（提示 / 答案）
  // INPUT-05：开放 bg/bgDisabled 参数，默认保持 INPUT-04 蓝色向后兼容
  _drawAuxButton(ctx, btn, scale, bg, bgDisabled) {
    const _bg = bg || AUX_BTN_BG;
    const _bgDis = bgDisabled || AUX_BTN_BG_DISABLED;
    ctx.save();
    ctx.fillStyle = btn.disabled ? _bgDis : _bg;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, AUX_BTN_RADIUS * (scale || 1));
    ctx.fill();
    ctx.fillStyle = btn.disabled ? AUX_BTN_FG_DISABLED : AUX_BTN_FG;
    ctx.font = `bold ${Math.floor(18 * (scale || 1))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2);
    ctx.restore();
  }

  // ---------------- GAME / RESULT （骨架保留） ----------------
  _renderGame(ctx, w, h, params) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    const backBtn = { key: 'back', text: '返回', x: 20, y: 30, w: 60, h: 32 };
    ctx.fillStyle = '#E9ECEF';
    roundRect(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, 6);
    ctx.fill();
    ctx.fillStyle = '#2E3A59';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('返回', backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h / 2);
    this.buttonsCache[PAGE.GAME] = [backBtn];

    const numbers = (params && params.numbers) || [1, 2, 3, 4];
    const cardW = 60;
    const cardH = 80;
    const gap = 16;
    const totalW = numbers.length * cardW + (numbers.length - 1) * gap;
    const startX = (w - totalW) / 2;
    const cardY = h * 0.35;
    numbers.forEach((n, i) => {
      const x = startX + i * (cardW + gap);
      ctx.fillStyle = '#4C6EF5';
      roundRect(ctx, x, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(String(n), x + cardW / 2, cardY + cardH / 2);
    });

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#8896AB';
    ctx.fillText('（核心玩法交互将在后续迭代实现）', w / 2, h * 0.55);
  }

  _renderResult(ctx, w, h, params) {
    ctx.fillStyle = '#F5F7FB';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2E3A59';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('本局结束', w / 2, h * 0.25);
    ctx.font = '18px sans-serif';
    ctx.fillText(`得分：${(params && params.score) || 0}`, w / 2, h * 0.35);
    ctx.fillText(`用时：${((params && params.time) || 0).toFixed(1)}s`, w / 2, h * 0.4);
    if (params && params.solution) {
      ctx.fillText(`参考解：${params.solution}`, w / 2, h * 0.45);
    }
    const btnW = w * 0.6;
    const btnH = 56;
    const gap = 16;
    const startY = h * 0.6;
    const buttons = [
      { key: 'retry', text: '再来一局' },
      { key: 'home', text: '返回首页' },
    ].map((b, i) => ({
      ...b,
      x: (w - btnW) / 2,
      y: startY + i * (btnH + gap),
      w: btnW,
      h: btnH,
    }));
    buttons.forEach((btn) => drawButton(ctx, btn));
    this.buttonsCache[PAGE.RESULT] = buttons;
  }

  _dealAction() {
    if (this.dealState === DEAL_STATE.DEALING) return;
    // INPUT-02：仅以下 2 行改动（Manager 方案 X 批准的最小 diff）：
    //   1) deal(4) → dealSolvable(4)（保证发牌可解）
    //   2) 拿到 4 张后调用 gameCore.recordSolutions(cards) 持有全解（R-03）
    // 布局 / 翻牌动画 / 状态机 / 按钮 / 文字 / 视觉常量均保持不变
    // INPUT-05：发牌模式分支—— solvable 沿用 dealSolvable；random 走 DealGenerator.generateRandom
    // dealMode 从启动时读取 loadSettings() 得到；面板保存后刷新 this._dealMode
    const mode = this._dealMode === DEAL_MODE.RANDOM ? DEAL_MODE.RANDOM : DEAL_MODE.SOLVABLE;
    this.dealtCards = generateHand(mode, this.deck);
    if (this.ui && this.ui.gameCore && typeof this.ui.gameCore.recordSolutions === 'function') {
      this.ui.gameCore.recordSolutions(this.dealtCards);
    }
    // INPUT-06：发牌后异步枚举倒数解（分区展示 + 提示需要）
    this._computeRecipAsync(this.dealtCards.map((c) => (c && typeof c.value === 'number' ? c.value : 0)));
    this.dealCount += 1;
    this.dealState = DEAL_STATE.DEALING;
    this.dealStartAt = Date.now();

    // INPUT-03：重置答题区与弹层，并同步牌面值
    if (this.answerArea) {
      this.answerArea.reset();
      this.answerArea.setCardValues(this.dealtCards.map((c) => (c && typeof c.value === 'number' ? c.value : 0)));
      this.answerArea.setEnabled(false); // 等 DONE 后在 _renderTable 重新启用
      // INPUT-06：同步高级计算开关（reset 不清开关，但保险重置）
      this.answerArea.setAdvancedCalc(this._advancedCalc);
      // 🔴 task-112 GUI-3：换牌时一并重置子开关（同上，保险）
      if (this.answerArea.setCaps) this.answerArea.setCaps(this._caps);
    }
    if (this.modal) this.modal.close();
    // INPUT-04：换牌时强制关闭提示 / 答案弹窗（提示进度自然清零）
    if (this.hintModal) this.hintModal.close();
    if (this.answerModal) this.answerModal.close();
    // INPUT-05：换牌时关闭无解弹窗
    if (this.noSolModal) this.noSolModal.close();
  }

  // INPUT-05：[无解] 按钮双分支处理
  //   - Solver 判无解（solutions.length===0）→ 庆祝弹窗～“本局确实无解！”
  //   - Solver 判有解 → toast “再想想…”
  //   - 两分支均不自动发牌（R-04 硬约束）
  // task-79 Bug B 修复：口径必须与答案窗口一致 —— 初级或高级任一有解即「有解」。
  //   开关语义：_advancedCalc 关闭时，RecipParser 会直接拒收 recip token（见 RecipParser L225），
  //   玩家根本无法输入 1/x ⇒ 高级解不可达，且答案窗口也不展示高级分区，
  //   故此时不计入高级解，三处（答案窗口/无解按钮/提示窗口）保持同一口径。
  _handleNoSolTap() {
    const gc = this.ui && this.ui.gameCore;
    if (!gc || typeof gc.getSolutions !== 'function') return;
    const primaryCount = gc.getSolutions().length;
    const d = this._recipDisplay;
    // 与答案窗口同口径：仅在开关开启时高级解才可见/可达
    const advCount = this._advancedCalc && d && d.counts ? d.counts.advanced : 0;
    const hasSolution = primaryCount > 0 || advCount > 0;
    if (!hasSolution) {
      this.noSolModal.showCelebrate();
    } else {
      this.noSolModal.showToast();
    }
  }

  // INPUT-03（Architect 60 号修订版）：提交处理
  // INPUT-06：改走 RecipParser.checkUserAnswer（支持 1/x + 精确 Fraction）
  //   开关关闭时行为与 INPUT-05 一致（无 recip token → 同样只会出 not_24 / division_by_zero）
  _doSubmit() {
    if (!this.answerArea.canSubmit()) return;
    const tokens = this.answerArea.getTokens();
    const cardValues = this.answerArea.cardValues;
    const result = checkUserAnswer(tokens, cardValues, { advancedCalc: this._advancedCalc });
    if (result.pass) {
      this.modal.showPass(this.answerArea.getFormulaText());
      return;
    }
    let msg;
    if (result.reason === 'division_by_zero') {
      msg = '算式包含除零，无法求值';
    } else if (result.reason === 'not_24') {
      msg = `结果 = ${result.actualLabel != null ? result.actualLabel : '?'}`;
    } else {
      // INPUT-06：parser 类错误（非法倒数 / 括号不匹配 / 用牌重复…）
      msg = result.message || '算式格式不正确';
    }
    this.modal.showFail(msg);
  }

  // INPUT-04：打开 HintModal
  // INPUT-06 §1.4：优先给 1 步初级答案；初级无解时给 1 步倒数答案
  _openHintModal() {
    if (this._recipComputing) return;   // 红1 方案 B：函数级自守卫，枚举窗口内不弹窗
    const gc = this.ui && this.ui.gameCore;
    // 优先：初级解 3 步提示（INPUT-04 原路径，保持回归）
    if (gc && typeof gc.getHintStep === 'function') {
      const s1 = gc.getHintStep(1);
      const s2 = gc.getHintStep(2);
      const s3 = gc.getHintStep(3);
      if (s1 && s2) { this.hintModal.open([s1, s2, s3]); return; }
    }
    // 初级无解：兢底给倒数解第 1 条（排序后）
    // task-79 Bug C 修复：原因不是「字段名错」—— buildDisplay() 确实导出 advancedTop（非 null 字符串）；
    //   真因是「结构不匹配」：HintModal 渲染的是 `${cur.lhs} ${cur.op} ${cur.rhs} = ${cur.result}`（见 HintModal L121），
    //   而此处原本交的是 { text, expr }，四个字段全为 undefined ⇒ 屏上出现 "undefined undefined undefined = undefined"。
    //   故改为构造 HintModal 约定的 {lhs, op, rhs, result} 形状；开关关闭时不泄题（与 Bug B 同口径）。
    const d = this._recipDisplay;
    const adv = this._advancedCalc && d ? d.advancedTop : null;
    if (adv) {
      // 🔴 task-111 GUI-1：旧实现把【整条算式】塞进 lhs（`高级解法：...`）并把同一
      //   step 传 3 次 ⇒ 根本没有分步，与初级解的分步口径不一。
      //   定界实测：只要初级解存在就走上方 postOrderSteps 正常分步（高级解不影响），
      //   故失效条件 = 【初级解 0 且 高级解 >0】（如 {5,8,9,10}），非「所有含高级解」。
      //   现改用 advPostOrderSteps 拆真分步（高级 AST 是 {op,a,b} 且含 recip/fact/mod
      //   三类叶子，Solver.postOrderSteps 读 args[] ⇒ 对它返回空数组，不可直接复用）。
      let advSteps = null;
      if (d.advancedTopNode) {
        try {
          const st = RecipSolver.advPostOrderSteps(d.advancedTopNode);
          if (st && st.length >= 2) advSteps = st;
        } catch (e) {
          console.error('[PageRenderer] advPostOrderSteps failed', e);
        }
      }
      if (advSteps) {
        // 高级解可能只 2 步（如 % 吃掉 2 张牌）⇒ 第 3 位补 null；
        // HintModal.open 仅要求 steps[0] 与 steps[1] 非空（见 HintModal L44）。
        this.hintModal.open([advSteps[0], advSteps[1], advSteps[2] || null]);
        return;
      }
      // 降级：拿不到 AST 或不足 2 步时仍给整条（优于不弹窗）
      const step = { step: 1, lhs: `高级解法：${adv}`, op: '', rhs: '', result: '24' };
      this.hintModal.open([step, step, step]);
      return;
    }
    // 两者均空：不弹（按钮已置灰的兼容分支）
  }

  // INPUT-04：打开 AnswerModal
  // INPUT-06 §1.4：分区显示「初级解法」在前、「高级解法」在后；
  //   每分区最多 10 条，超出末尾显示「…等共 N 条」；空分区给明确文案
  _openAnswerModal() {
    if (this._recipComputing) return;   // 红1 方案 B：函数级自守卫，枚举窗口内不弹窗
    const lines = [];
    const d = this._recipDisplay;

    // ---- 初级解法分区 ----
    lines.push('【初级解法】');
    if (d && d.primary.length > 0) {
      for (const e of d.primary) lines.push(`${e} = 24`);
      if (d.counts.primary > d.primary.length) lines.push(`…等共 ${d.counts.primary} 条`);
    } else {
      lines.push('本局无初级解法');
    }

    // ---- 高级解法分区（开关关闭时不展示，避免泄题未开启的用法）----
    if (this._advancedCalc) {
      lines.push('');
      lines.push('【高级解法】');
      if (d && d.advanced.length > 0) {
        for (const e of d.advanced) lines.push(`${e} = 24`);
        if (d.counts.advanced > d.advanced.length) lines.push(`…等共 ${d.counts.advanced} 条`);
      } else {
        lines.push('本局无倒数解法');
      }
    }

    // 降级：_recipDisplay 未就绪（理论上按钮已置灰）→ 回退 INPUT-04 路径
    if (!d) {
      const gc = this.ui && this.ui.gameCore;
      if (gc && typeof gc.getAllSolutions === 'function') {
        const sols = gc.getAllSolutions();
        // task-79 Bug A：降级路径给的是裸算式（getAllSolutions 不带 = 24），
        //   而 AnswerModal 已不再自动加后缀 ⇒ 此处自行拼接，且 count 就是真实解数。
        const dispLines = sols.map((e) => `${e} = 24`);
        this.answerModal.open(dispLines, { count: sols.length });
        return;
      }
    }
    // task-79 Bug A：count 传真实解法条数（不含标题/空行/计数行）；
    //   高级解仅在开关开启时计入，与无解按钮/提示窗口同口径。
    const solTotal =
      (d && d.counts ? d.counts.primary : 0) +
      (this._advancedCalc && d && d.counts ? d.counts.advanced : 0);
    this.answerModal.open(lines, { count: solTotal });
  }

  _onButtonTap(page, key) {
    if (page === PAGE.INDEX) {
      if (key === 'table') this.ui.switchTo(PAGE.TABLE);
      else if (key === 'rank') wx.showToast && wx.showToast({ title: '排行榜开发中', icon: 'none' });
      else if (key === 'help')
        wx.showModal &&
          wx.showModal({
            title: '游戏说明',
            content: '系统随机给出 4 张扑克牌，使用 + - × ÷ 计算出 24 即胜利。',
            showCancel: false,
          });
    } else if (page === PAGE.TABLE) {
      if (key === 'back') this.ui.switchTo(PAGE.INDEX);
      else if (key === 'deal') this._dealAction();
      else if (key === 'hint') this._openHintModal();
      else if (key === 'answer') this._openAnswerModal();
      else if (key === 'startAnswer') this.answerArea.openArea();   // INPUT-06
      else if (key === 'settings') {
        // INPUT-05：打开设置面板；保存回调刷新当前 dealMode
        // INPUT-06：回调同时接收 advancedCalc
        this.settingsPanel.open((newMode, newAdv, newCaps) => {
          this._dealMode = newMode;
          this._settings = loadSettings();
          this._applyAdvancedCalc(newAdv !== undefined ? newAdv : this._settings.advancedCalc, newCaps);
        });
      }
    } else if (page === PAGE.GAME) {
      if (key === 'back') this.ui.switchTo(PAGE.INDEX);
    } else if (page === PAGE.RESULT) {
      if (key === 'retry') this.ui.switchTo(PAGE.GAME);
      else if (key === 'home') this.ui.switchTo(PAGE.INDEX);
    }
  }
}
