#!/usr/bin/env bash
# exitcode-audit.sh —— 静态审计：管道后取退出码（假绿）+ cmd 单行提前展开（假绿）
#
# 背景（task-69 / task-72 实测）：
#   ① `cmd | findstr xxx; echo $?`     ⇒ $? 取的是【管道末端】的码，恒 0
#   ② `cmd & echo exit=%errorlevel%`   ⇒ cmd.exe 解析整行时就展开 %errorlevel%，
#                                          早于命令执行 ⇒ 恒为上一条的旧值（实测得 0）
#   两者都会产出「永远绿」的退出码。
#
# ⚠️ 规则 17：本审计器【先自证方言】—— 用 --selftest 构造必然命中的正例，
#    确认尺子有效后再扫全项目。零命中若未自验，不予采信。
#
# ⚠️ 规则 19（探测也有地板）：本脚本是【静态文本扫描】，以下情况它抓不到：
#    (a) 取码逻辑跨多行拼接、或经变量间接构造（如 CMD="$C | grep x"; eval "$CMD"）
#    (b) 在其它语言里取码（python subprocess / node child_process）
#    (c) 运行时才决定是否走管道
#    ⇒ 它只覆盖最常见的「同行/紧邻行」写法。零命中 ≠ 全项目安全。
set -uo pipefail

SELF="$(basename "${BASH_SOURCE[0]}")"
not_self() { [ "$(basename "${1%%:*}")" != "$SELF" ]; }

hits=0
report() { printf '  🔴 %s\n' "$1"; hits=$((hits+1)); }

scan_one() {
  local f="$1"
  # 逐行读入数组，便于看「紧邻行」
  mapfile -t L < "$f" 2>/dev/null || return 0
  local n=${#L[@]} i cur prev
  for ((i=0; i<n; i++)); do
    cur="${L[i]}"
    # 跳过注释行（# 或 // 或 rem 开头）
    case "$(printf '%s' "$cur" | sed 's/^[[:space:]]*//')" in
      '#'*|'//'*|rem\ *|REM\ *|::*) continue;;
    esac

    # ---- 模式①：同一行内 管道 + 取码 ----
    if printf '%s' "$cur" | grep -q '|' ; then
      if printf '%s' "$cur" | grep -qE '\$\?|%errorlevel%|%ERRORLEVEL%'; then
        report "$f:$((i+1)) [同行:管道+取码] $(printf '%s' "$cur" | sed 's/^[[:space:]]*//' | cut -c1-90)"
        continue
      fi
    fi

    # ---- 模式②：上一行有管道，本行取码 ----
    if ((i>0)); then
      prev="${L[i-1]}"
      if printf '%s' "$prev" | grep -q '|' \
         && printf '%s' "$cur" | grep -qE '\$\?|%errorlevel%|%ERRORLEVEL%'; then
        report "$f:$((i+1)) [紧邻:上行管道+本行取码] $(printf '%s' "$cur" | sed 's/^[[:space:]]*//' | cut -c1-90)"
        continue
      fi
    fi

    # ---- 模式③：cmd 单行 & 串联里取 %errorlevel%（提前展开陷阱）----
    if printf '%s' "$cur" | grep -qE '&[[:space:]]*echo[^|]*%errorlevel%'; then
      report "$f:$((i+1)) [cmd单行&串联:%errorlevel%提前展开] $(printf '%s' "$cur" | sed 's/^[[:space:]]*//' | cut -c1-90)"
    fi

    # ---- 模式④：ssh/sshpass 取码，未区分「连接失败」与「远端命令失败」----
    #   实测(2026-08-05)：远端 exit 3 → 本地 $?=3（正确转发）；
    #                     密码错(未跑到远端) → 本地 $?=5；ssh 自身错通常 255。
    #   ⇒ 若直接把 $? 当作被测脚本结果，连不上会被误报成「被测失败」。
    if ((i>0)); then
      prev="${L[i-1]}"
      if printf '%s' "$prev" | grep -qE 'sshpass|(^|[^a-zA-Z])ssh ' \
         && printf '%s' "$cur" | grep -qE '\$\?' ; then
        report "$f:$((i+1)) [ssh取码:未区分连接失败(5/255)与远端失败] $(printf '%s' "$cur" | sed 's/^[[:space:]]*//' | cut -c1-90)"
      fi
    fi

    # ---- 模式⑤：脚本内硬写 IP（违反 TOOLS.md：凭据/地址只读入变量）----
    if printf '%s' "$cur" | grep -qE '([0-9]{1,3}\.){3}[0-9]{1,3}' \
       && ! printf '%s' "$cur" | grep -qE '127\.0\.0\.1|0\.0\.0\.0|18\.18|22\.15|23\.5'; then
      report "$f:$((i+1)) [硬写IP:违反TOOLS.md] $(printf '%s' "$cur" | sed 's/^[[:space:]]*//' | cut -c1-90)"
    fi
  done
}

selftest() {
  local d; d="$(mktemp -d)"
  cat > "$d/pos1.sh" <<'P1'
node x.mjs 2>&1 | head -2
echo exit=$?
P1
  cat > "$d/pos2.sh" <<'P2'
node x.mjs 2>&1 | grep pass= ; echo "rc=$?"
P2
  printf '%s\r\n' 'node x.mjs & echo exit=%errorlevel%' > "$d/pos3.bat"
  cat > "$d/pos4.sh" <<'P4'
sshpass -e ssh user@host "node x.mjs"
echo "EXITCODE=$?"
P4
  cat > "$d/pos5.sh" <<'P5'
SSH="sshpass -e ssh Administrator@203.0.113.7"
P5
  cat > "$d/clean.sh" <<'C1'
node x.mjs > out.txt 2>&1
echo exit=$?
node y.mjs 2>&1 | head -2
echo "rc=${PIPESTATUS[0]}"
C1
  echo "──── 自证：5 个正例（应各命中）+ 1 个干净样本（应零命中）────"
  local before after
  for f in pos1.sh pos2.sh pos3.bat pos4.sh pos5.sh; do
    before=$hits; scan_one "$d/$f"; after=$hits
    if ((after>before)); then echo "  ✅ $f 命中 $((after-before)) 处（尺子有效）"
    else echo "  ❌ $f 未命中 ⇒ 尺子失效，后续零命中不可采信"; fi
  done
  before=$hits; scan_one "$d/clean.sh"; after=$hits
  if ((after==before)); then echo "  ✅ clean.sh 零命中（无假阳）"
  else echo "  ❌ clean.sh 误报 $((after-before)) 处 ⇒ 假阳，需修模式"; fi
  rm -rf "$d"
  echo "──── 自证结束（以上命中不计入正式扫描）────"
  hits=0
}

if [ "${1:-}" = "--selftest" ]; then selftest; exit 0; fi

echo "════ 规则 17 自证方言（先证尺子有效）════"
selftest
echo
echo "════ 正式扫描 ════"
for t in "$@"; do
  if [ -f "$t" ]; then not_self "$t" && scan_one "$t"
  elif [ -d "$t" ]; then
    while IFS= read -r f; do not_self "$f" && scan_one "$f"
    done < <(find "$t" -type f \( -name '*.sh' -o -name '*.bat' -o -name '*.cmd' -o -name '*.ps1' \) 2>/dev/null)
  fi
done
echo
if ((hits==0)); then
  echo "✅ 零命中（尺子已自证有效；但请注意上方「抓不到」的三类局限）"
else
  echo "🔴 共 $hits 处，请改为：不经管道取码，或用 \${PIPESTATUS[0]}（Windows 见规范）"
fi
exit 0
