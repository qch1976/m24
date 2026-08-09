// tester-task97-csv-sample.mjs
// task-97 收窄范围：从开发 325 条清单抽 ≥30 行（三类各 ≥5），用**自建 evaluator** 复算
//   ① 值是否真为 24    ② 原式牌数是否为 4
// 🔴 独立性：本脚本零 import 产品代码，不调 RecipSolver 的 evalNode/parse/render。
//    自建 Fraction(BigInt) + 自写 tokenizer/parser，先过自验尺子再投入使用。
import fs from 'fs';

// ══════════ 自建 Fraction（BigInt，零浮点） ══════════
const g = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; };
function Q(n, d = 1n) {
  n = BigInt(n); d = BigInt(d);
  if (d === 0n) throw new Error('DIV0');
  if (d < 0n) { n = -n; d = -d; }
  const k = g(n, d) || 1n;
  return { n: n / k, d: d / k };
}
const add = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => Q(a.n * b.n, a.d * b.d);
const div = (a, b) => { if (b.n === 0n) throw new Error('DIV0'); return Q(a.n * b.d, a.d * b.n); };
const isInt = (q) => q.d === 1n;
function fact(q) {
  if (!isInt(q) || q.n < 0n) throw new Error('FACT_BAD');
  let r = 1n; for (let i = 2n; i <= q.n; i++) r *= i;
  return Q(r);
}
function mod(a, b) {
  if (!isInt(a) || !isInt(b)) throw new Error('MOD_NONINT');
  if (b.n === 0n) throw new Error('MOD0');
  return Q(a.n % b.n);
}
const eq = (a, b) => a.n * b.d === b.n * a.d;
const is24 = (q) => q.n === 24n * q.d;

// ══════════ 自写 tokenizer / parser（支持 ! 后缀、% 中缀、÷ × − 全角、(1/4) 与 (1÷4)） ══════════
function tokenize(s) {
  const t = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i++; continue; }
    if (/[0-9]/.test(c)) { let j = i; while (j < s.length && /[0-9]/.test(s[j])) j++; t.push({ k: 'num', v: s.slice(i, j) }); i = j; continue; }
    if ('()'.includes(c)) { t.push({ k: c }); i++; continue; }
    if (c === '!') { t.push({ k: '!' }); i++; continue; }
    if (c === '%') { t.push({ k: '%' }); i++; continue; }
    if (c === '+') { t.push({ k: '+' }); i++; continue; }
    if (c === '-' || c === '\u2212') { t.push({ k: '-' }); i++; continue; }
    if (c === '*' || c === '\u00d7') { t.push({ k: '*' }); i++; continue; }
    if (c === '/' || c === '\u00f7') { t.push({ k: '/' }); i++; continue; }
    throw new Error('BAD_CHAR:' + c + '(U+' + c.charCodeAt(0).toString(16) + ')');
  }
  return t;
}
// 文法：E := T (('+'|'-') T)*   T := P (('*'|'/'|'%') P)*   P := A '!'*   A := num | '(' E ')'
function makeParser(t) {
  let p = 0; const cards = [];
  const peek = () => t[p]; const eat = (k) => { if (!t[p] || t[p].k !== k) throw new Error('EXPECT ' + k); return t[p++]; };
  function A() {
    if (peek() && peek().k === 'num') { const v = eat('num').v; cards.push(Number(v)); return Q(BigInt(v)); }
    if (peek() && peek().k === '(') { eat('('); const v = E(); eat(')'); return v; }
    throw new Error('BAD_ATOM');
  }
  function P() { let v = A(); while (peek() && peek().k === '!') { eat('!'); v = fact(v); } return v; }
  function T() {
    let v = P();
    while (peek() && (peek().k === '*' || peek().k === '/' || peek().k === '%')) {
      const o = t[p++].k; const r = P();
      v = o === '*' ? mul(v, r) : o === '/' ? div(v, r) : mod(v, r);
    }
    return v;
  }
  function E() {
    let v = T();
    while (peek() && (peek().k === '+' || peek().k === '-')) { const o = t[p++].k; const r = T(); v = o === '+' ? add(v, r) : sub(v, r); }
    return v;
  }
  const val = E();
  if (p !== t.length) throw new Error('TRAILING');
  return { val, cards };
}
const evalExpr = (s) => makeParser(tokenize(s));

// ══════════ 尺子自验（必须先证 evaluator 可信，且能判红） ══════════
console.log('=== evaluator 自验（正例须对、反例须红） ===');
let selfOk = 0, selfBad = 0;
const S = (expr, want, label) => {
  try {
    const { val } = evalExpr(expr);
    const ok = eq(val, want);
    console.log(`  ${ok ? 'ok' : 'XX'}  ${label.padEnd(22)} ${expr}  = ${val.n}/${val.d}  期望 ${want.n}/${want.d}`);
    ok ? selfOk++ : selfBad++;
  } catch (e) { console.log(`  XX  ${label} ${expr} 抛错 ${e.message}`); selfBad++; }
};
S('3!', Q(6n), '阶乘 3!');
S('0!', Q(1n), '阶乘 0!（0→1）');
S('4!', Q(24n), '阶乘 4!');
S('7%3', Q(1n), '模 7%3');
S('2%1', Q(0n), '模 2%1（得0）');
S('(1/4)', Q(1n, 4n), '分数 1/4');
S('12/(1/2)', Q(24n), '除以分数');
S('((0+0)+4)*6', Q(24n), '括号链');
S('(((0%1)+0!)\u00d74!)', Q(24n), '全角×+阶乘+模');
S('(3-(1\u00f73))\u00d79', Q(24n), '全角÷ 与 −');
// 反例尺子：evaluator 必须判红错误期望（防哑弹）
const NEG = (expr, wrongWant, label) => {
  const { val } = evalExpr(expr);
  const red = !eq(val, wrongWant);
  console.log(`  ${red ? 'ok' : 'XX'}  ${label.padEnd(22)} ${expr} \u2260 ${wrongWant.n}/${wrongWant.d}（须判红）实得 ${val.n}/${val.d}`);
  red ? selfOk++ : selfBad++;
};
NEG('3!', Q(9n), '反例 3!\u22609');
NEG('7%3', Q(2n), '反例 7%3\u22602');
NEG('4!+1+(1-1)', Q(24n), '反例 4!+1+(1-1)\u226024');
console.log(`  自验：ok=${selfOk} bad=${selfBad}`);
if (selfBad) { console.log('\n\ud83d\udd34 evaluator 自验未过，拒绝投入使用'); process.exit(2); }

// ══════════ 读 CSV（用严格 CSV 解析，不用 awk/split 分隔符） ══════════
function parseCSV(txt) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}
const CSV = process.argv[2];
const raw = fs.readFileSync(CSV, 'utf8').replace(/^\uFEFF/, '');
const rows = parseCSV(raw);
const head = rows[0];
const data = rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
console.log(`\n=== CSV 读取 ===\n  文件 ${CSV}\n  表头 ${JSON.stringify(head)}\n  数据行 ${data.length}`);

// ══════════ 分层抽样：F1M1 / F1M0 / F0M1 三类各 ≥5，总 ≥30 ══════════
const clsOf = (k) => { const m = /\|(F[01]M[01])$/.exec(k || ''); return m ? m[1] : 'NONE'; };
const buckets = {};
for (const r of data) { const c = clsOf(r.key); (buckets[c] = buckets[c] || []).push(r); }
console.log('  分类分布：' + Object.entries(buckets).map(([k, v]) => `${k}=${v.length}`).join('  '));

// 确定性均匀抽样（等距取样，覆盖首中尾，避免只取前 N 行）
function pick(arr, n) {
  if (arr.length <= n) return arr.slice();
  const out = []; const step = arr.length / n;
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}
const WANT = { F1M1: 15, F1M0: 8, F0M1: 8 };   // 15+8+8 = 31 ≥30，三类各 ≥5
const sample = [];
for (const [c, n] of Object.entries(WANT)) {
  const got = pick(buckets[c] || [], n);
  if (got.length < 5) { console.log(`\n\ud83d\udd34 类 ${c} 可抽样本不足 5（实有 ${(buckets[c] || []).length}），如实上报`); }
  sample.push(...got);
}
console.log(`  抽样：${Object.entries(WANT).map(([c, n]) => `${c}\u2192${Math.min(n, (buckets[c] || []).length)}`).join('  ')}   合计 ${sample.length} 行`);

// ══════════ 逐条复算 ══════════
console.log('\n=== 逐条独立复算（值=24？ 原式牌数=4？） ===');
let badVal = 0, badCards = 0, parseFail = 0;
const details = [];
for (const r of sample) {
  const cls = clsOf(r.key);
  let line;
  try {
    const { val, cards } = evalExpr(r.display);
    const v24 = is24(val);
    const c4 = cards.length === 4;
    if (!v24) badVal++;
    if (!c4) badCards++;
    line = `  ${v24 && c4 ? 'ok' : 'XX'}  ${cls}  ${r.deck}  ${r.display}  = ${val.n}/${val.d}  牌数=${cards.length}${v24 ? '' : '  \u2190值\u226024'}${c4 ? '' : '  \u2190牌数\u22604'}`;
  } catch (e) {
    parseFail++; badVal++;
    line = `  XX  ${cls}  ${r.deck}  ${r.display}  \u89e3\u6790/\u6c42\u503c\u5931\u8d25: ${e.message}`;
  }
  details.push(line);
}
details.forEach((l) => console.log(l));

console.log('\n' + '='.repeat(64));
console.log(`[task-97] 抽样数 = ${sample.length}`);
console.log(`[task-97] 值\u226024 条数 = ${badVal}`);
console.log(`[task-97] 牌数\u22604 条数 = ${badCards}`);
if (parseFail) console.log(`[task-97] （其中解析/求值失败 = ${parseFail}，已计入值\u226024）`);
console.log('='.repeat(64));
process.exit(badVal === 0 && badCards === 0 ? 0 : 1);
