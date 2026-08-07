#!/usr/bin/env bash
# tools/verify/run-gate.sh — 验收统一入口（task-115 ⑥）
#
# 立意：0234c18 那次「条款 8 exit 2 被读成 0」的失败形态是**人工敲的验收命令行**，
#   不落盘 ⇒ tester/audit/exitcode-audit.sh（静态扫 git ls-files）对它天然不可见
#   （见该脚本规则 19 自述局限）。规范（EXITCODE-RULES.md）也只能靠人记得遵守。
# ⇒ 本脚本把「正确取码」做成**默认行为**：验收方不需要记住 PIPESTATUS，
#   照样拿到真码；想过滤输出也不会把码弄丢。
#
# 用法：
#   tools/verify/run-gate.sh <脚本路径> [--hooks] [--grep 过滤串]
#     --hooks  用 --import ./tester/render-smoke/esm-hooks.mjs 跑（无扩展名 import 的脚本需要）
#     --grep   只显示匹配行（🔴 过滤【不影响】退出码，这正是本脚本存在的理由）
#   tools/verify/run-gate.sh --selftest    # 🔴 先自证尺子：证明它能把 exit 2 读成 2
#
# 退出码：原样透传被测脚本的码（0=绿，2=条款8 断言总数不符，其它=断言失败等）
set -uo pipefail

# ── 自证方言（规则 17：尺子先自验，且验在下结论之前）──
if [ "${1:-}" = "--selftest" ]; then
  echo "════ run-gate 自证：能否正确读到非 0 退出码 ════"
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
  # 造一个必然 exit 2 的样本（模拟条款 8 断言总数不符）
  cat > "$tmp/ec2.mjs" <<'EOS'
console.log('pass=5 fail=0');
console.log('🔴 FAIL 条款8 断言总数不符：期望 22，实际 25');
process.exit(2);
EOS
  cat > "$tmp/ec0.mjs" <<'EOS'
console.log('pass=5 fail=0');
console.log('ALL PASS');
EOS
  fails=0
  # 反例：管道取码（0234c18 的错法）——必须复现出「假绿 0」，否则说明环境变了
  # 🔴 本脚本顶部开了 `set -o pipefail`，它会【把管道修好】⇒ 直接在这里跑反例会得 2，
  #   反而复现不出缺陷（我首版就栍在这，自证当场拿下）。
  #   验收方的交互 shell 默认【无 pipefail】，故反例必须在 `set +o pipefail` 下跑。
  bad=$(set +o pipefail; node "$tmp/ec2.mjs" 2>&1 | tail -1 >/dev/null; echo $?)
  if [ "$bad" -eq 0 ]; then
    echo "  🔴 对照：无 pipefail 时 \`node ... | tail -1; \$?\` ⇒ 0（假绿，已复现 0234c18 的失败形态）"
  else
    echo "  ⚠️  对照未复现假绿（得 $bad）—— 环境 shell 行为与预期不符，请人工确认"
    fails=$((fails+1))
  fi
  # 正例1：本脚本跑 exit 2 的样本，须得 2（含 --grep 过滤时也须得 2）
  "$0" "$tmp/ec2.mjs" >/dev/null 2>&1; got=$?
  [ "$got" -eq 2 ] && echo "  ✅ run-gate 裸跑 exit2 样本 ⇒ 2" || { echo "  🔴 run-gate 裸跑得 $got，应为 2"; fails=$((fails+1)); }
  "$0" "$tmp/ec2.mjs" --grep "pass=" >/dev/null 2>&1; got=$?
  [ "$got" -eq 2 ] && echo "  ✅ run-gate 带 --grep 过滤 ⇒ 仍为 2（过滤不吞码）" || { echo "  🔴 带 --grep 得 $got，应为 2"; fails=$((fails+1)); }
  # 正例2：绿样本须得 0（防「一律判红」把尺子刷绿）
  "$0" "$tmp/ec0.mjs" >/dev/null 2>&1; got=$?
  [ "$got" -eq 0 ] && echo "  ✅ run-gate 跑绿样本 ⇒ 0（不误报红）" || { echo "  🔴 绿样本得 $got，应为 0"; fails=$((fails+1)); }
  echo "════ 自证结束：fail=$fails ════"
  [ "$fails" -eq 0 ] || exit 1
  echo "✅ 尺子有效"
  exit 0
fi

if [ $# -lt 1 ]; then
  echo "用法: $0 <脚本路径> [--hooks] [--grep 串] | $0 --selftest" >&2
  exit 64
fi

TARGET="$1"; shift
HOOKS=0; FILTER=""
while [ $# -gt 0 ]; do
  case "$1" in
    --hooks) HOOKS=1; shift ;;
    --grep)  FILTER="${2:-}"; shift 2 ;;
    *) echo "未知参数: $1" >&2; exit 64 ;;
  esac
done

[ -f "$TARGET" ] || { echo "🔴 找不到脚本: $TARGET（路径类误判先怀疑自己的路径）" >&2; exit 66; }

OUT="$(mktemp)"; trap 'rm -f "$OUT"' EXIT

# 🔴 核心：**先重定向到文件再取码**，全程不经管道 ⇒ $? 必是 node 自己的码。
#   过滤在取码【之后】对文件做，故过滤器的码永远不会污染判定。
if [ "$HOOKS" -eq 1 ]; then
  node --import ./tester/render-smoke/esm-hooks.mjs "$TARGET" > "$OUT" 2>&1
else
  node "$TARGET" > "$OUT" 2>&1
fi
RC=$?

if [ -n "$FILTER" ]; then
  grep -E "$FILTER" "$OUT" || true      # || true：过滤无命中不得改变 RC
else
  cat "$OUT"
fi

echo "rc=$RC  ($(basename "$TARGET"))"
exit "$RC"
