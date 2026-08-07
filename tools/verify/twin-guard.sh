#!/usr/bin/env bash
# tools/verify/twin-guard.sh — .js/.mjs 孪生一致性守护（task-115 ④）
#
# 背景：task-111 我改了 js/core/Settings.js 却漏改 Settings.mjs
#   ⇒ v22 全绿（产品代码走 .js），v24 fail=2（selftest import .mjs）。
#   「单平台绿」是哑弹。本守护就是把这类漏改在提交前拦下。
#
# ── 🔴 判据选型（规则 11：尺子先自验，且验在下结论之前）──
# 我先扫了现状，**没有**直接采用「剥 import/export 后 diff 行数须为 0」：
#   实测 12 对孪生里 Card(30) / Deck(44) / DealGenerator(8) / RecipParser(2) 差异非 0，
#   逐条看原文后确认**全是无害差异**，不是逻辑漂移：
#     · Card/Deck/DealGenerator 的 .mjs 是【有意精简的紧凑副本】
#       （Card .js 62 行 vs .mjs 26 行：对象字面量单行 vs 逐行、单行 return vs 多行）
#     · Deck/DealGenerator 还差在【行尾注释】
#     · RecipParser 差在 import 扩展名（'./RecipSolver.mjs' vs './RecipSolver'）
#   ⇒ 若采用行 diff，这 4 对会**恒红**，守护立刻失去意义（狼来了）。
#   （我 TOOLS.md 里记着同一个坑：第 3 次口径型误判就是它。）
#
# ⇒ 故采用**分层判据**，每层量的都是直接量：
#   L1 导出符号集一致 —— 漏改新增/重命名导出必红（task-111 正是此类）
#   L2 语义 token 流一致 —— 剥注释+去空白+规范化 import 扩展名后比对；
#      仅对【已知逐字对应】的孪生强制（token 流当前已一致的那些），
#      对 3 个精简副本降级为 L1+L3，避免恒红
#   L3 两侧都能被 node 成功解析（.mjs 直接 import；.js 语法检查）
#
# 用法：
#   tools/verify/twin-guard.sh              # 正式扫描
#   tools/verify/twin-guard.sh --selftest   # 🔴 自证尺子：造不一致须判红
# 退出码：0=全部一致；1=发现不一致；2=尺子自证失败
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 2

# 「有意精简副本」白名单：只跑 L1+L3，不比 token 流。
# 🔴 白名单是**豁免 L2、不豁免 L1**：漏改导出照样红。
CONDENSED="js/core/Card.mjs js/core/Deck.mjs js/core/DealGenerator.mjs"

norm() {   # 剥注释 → 去空白 → 规范化 import 扩展名
  sed -e 's://.*::' -e '/^[[:space:]]*\/\*/,/\*\//d' "$1" \
    | tr -d ' \t\n' \
    | sed -e "s:\.mjs':':g" -e 's:\.mjs":":g'
}
exports_of() {
  { grep -oE '^[[:space:]]*export (default |async )?(function|class|const|let)[[:space:]]+[A-Za-z_$][A-Za-z0-9_$]*' "$1" 2>/dev/null | awk '{print $NF}'
    grep -oE '^[[:space:]]*export[[:space:]]*\{[^}]*\}' "$1" 2>/dev/null | tr -d '{} \t' | sed 's/export//' | tr ',' '\n' | sed 's/asdefault//'
  } | grep -v '^$' | sort -u
}

check_pair() {   # $1=.js  $2=.mjs  → 0 一致 / 1 不一致
  local j="$1" m="$2" bad=0 tag
  tag="$(basename "$j")"
  # L1 导出符号集
  if [ "$(exports_of "$m")" != "$(exports_of "$j")" ]; then
    echo "  🔴 [L1 导出符号集不一致] $j ↔ $m"
    diff <(exports_of "$m") <(exports_of "$j") | sed 's/^/        /'
    bad=1
  fi
  # L2 语义 token 流（精简副本豁免）
  if ! printf '%s\n' $CONDENSED | grep -qx "$m"; then
    if [ "$(norm "$m" | md5sum)" != "$(norm "$j" | md5sum)" ]; then
      echo "  🔴 [L2 语义 token 流不一致] $j ↔ $m"
      echo "        （剥注释/空白/import 扩展名后仍不同 ⇒ 逻辑漂移，非格式差异）"
      diff <(sed -e 's://.*::' "$m" | grep -vE '^[[:space:]]*$|^[[:space:]]*(import|export) ') \
           <(sed -e 's://.*::' "$j" | grep -vE '^[[:space:]]*$|^[[:space:]]*(import|export) ') \
        | head -8 | sed 's/^/        /'
      bad=1
    fi
  fi
  [ "$bad" -eq 0 ] && echo "  ✅ $tag" || true
  return $bad
}

# ────────── 自证方言（规则 17）──────────
if [ "${1:-}" = "--selftest" ]; then
  echo "════ twin-guard 自证：造不一致必须判红 ════"
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
  fails=0
  # 正例1：漏改导出（task-111 的真实形态）
  printf 'export function a(){return 1;}\nexport function b(){return 2;}\n' > "$tmp/x.js"
  printf 'export function a(){return 1;}\n' > "$tmp/x.mjs"
  if check_pair "$tmp/x.js" "$tmp/x.mjs" >/dev/null 2>&1; then
    echo "  🔴 正例1（漏改导出 b）未判红 ⇒ 尺子失效"; fails=$((fails+1))
  else echo "  ✅ 正例1 漏改导出 ⇒ 判红"; fi
  # 正例2：逻辑漂移（导出同名但函数体不同）
  printf 'export function a(){return 1;}\n' > "$tmp/y.js"
  printf 'export function a(){return 999;}\n' > "$tmp/y.mjs"
  if check_pair "$tmp/y.js" "$tmp/y.mjs" >/dev/null 2>&1; then
    echo "  🔴 正例2（函数体漂移）未判红 ⇒ 尺子失效"; fails=$((fails+1))
  else echo "  ✅ 正例2 函数体漂移 ⇒ 判红"; fi
  # 反例：仅注释/空白/import 扩展名不同 ⇒ 必须放行（防恒红）
  printf 'import {z} from "./q";\n// 注释A\nexport function a(){\n  return 1;\n}\n' > "$tmp/z.js"
  printf 'import {z} from "./q.mjs";\nexport function a(){ return 1; }\n' > "$tmp/z.mjs"
  if check_pair "$tmp/z.js" "$tmp/z.mjs" >/dev/null 2>&1; then
    echo "  ✅ 反例 仅注释/空白/扩展名差异 ⇒ 放行（不误报）"
  else
    echo "  🔴 反例被误判红 ⇒ 会恒红，尺子不可用"; fails=$((fails+1))
  fi
  echo "════ 自证结束 fail=$fails ════"
  [ "$fails" -eq 0 ] || exit 2
  echo "✅ 尺子有效（能抓漏改与漂移，且不误报格式差异）"
  exit 0
fi

# ────────── 正式扫描 ──────────
echo "════ 孪生一致性扫描（HEAD=$(git rev-parse --short HEAD)）════"
pairs=0; bad=0
for j in $(git ls-files '*.js'); do
  m="${j%.js}.mjs"
  git ls-files --error-unmatch "$m" >/dev/null 2>&1 || continue
  pairs=$((pairs+1))
  check_pair "$j" "$m" || bad=$((bad+1))
done
echo "──────────"
echo "孪生对数=$pairs  不一致=$bad"
# 无孪生的 .js 只作提示，不判红（UI 层多数无 .mjs，属既定现状）
solo=0
for j in $(git ls-files '*.js'); do
  m="${j%.js}.mjs"
  git ls-files --error-unmatch "$m" >/dev/null 2>&1 || solo=$((solo+1))
done
echo "无孪生 .js=$solo（仅提示：新增 selftest 若要 import 它们须先建孪生）"
if [ "$bad" -ne 0 ]; then
  echo "🔴 FAIL：$bad 对孪生不一致 —— 改了 .js 必须同步 .mjs（否则 v24 必红）"
  exit 1
fi
echo "✅ PASS：$pairs 对孪生全部一致"
exit 0
