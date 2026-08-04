# 退出码取法规范（团队检查项 · task-72 立 · 2026-08-05）

> 立规起因：`cmd | findstr xxx & echo exit=%errorlevel%` 恒 0 ⇒ **假绿**。
> 全项目 11 处取码点经 Manager 逐行核 + Tester 静态审计**双向交叉确认均未中招**，
> 但那是**运气不是设计**。故立为强制检查项。

## 一、四种已实证的取码陷阱

| # | 写法 | 实测结果 | 真因 |
|---|---|---|---|
| ① | `cmd \| head -2; echo $?` | **0**（假绿）| `$?` 取的是**管道末端**进程的码 |
| ② | `cmd & echo exit=%errorlevel%`（cmd.exe 单行）| **0**（假绿）| cmd 解析**整行时**就展开 `%errorlevel%`，早于命令执行 |
| ③ | `sshpass -e ssh host "cmd"` 后取 `$?` | 连接失败得 **5**，ssh 自身错 **255** | 与「远端命令真失败」**无法区分** |
| ④ | 远端 `cmd /c exit 3` 后取 `$?` | **3** ✅ | 这条是**正确**的，ssh 会转发远端码 |

②的实测对照（2026-08-05，Node v24.15.0，Windows）：

| 取法 | 得到 |
|---|---|
| SSH 单行 `... & echo exit=%errorlevel%` | `0` 🔴 |
| 写进 `.bat` 文件后 `echo exit=%errorlevel%` | `1` ✅ |
| `(cmd) && echo 成功 \|\| echo 失败` | 走「失败」分支 ✅ |

⇒ **同一命令，取法不同得 0 或 1。**

## 二、强制规范

### Bash / Linux 侧

```bash
# ❌ 禁止
node x.mjs 2>&1 | head -2
echo exit=$?                    # 恒 0

# ✅ 方式1：不经管道
node x.mjs > out.txt 2>&1
echo exit=$?

# ✅ 方式2：管道必需时用 PIPESTATUS
node x.mjs 2>&1 | head -2
echo exit=${PIPESTATUS[0]}
```

### cmd.exe / Windows 侧

```bat
REM ❌ 禁止：SSH 单行 & 串联取码（提前展开）
node x.mjs & echo exit=%errorlevel%

REM ✅ 方式1：写进 .bat 文件（延迟展开正常）
node x.mjs
echo exit=%errorlevel%

REM ✅ 方式2：单行内必须判时，用 && / || 分支而非取值
(node x.mjs) && echo RESULT=PASS || echo RESULT=FAIL

REM ✅ 方式3：开延迟展开
setlocal enabledelayedexpansion
node x.mjs
echo exit=!errorlevel!
```

⚠️ **bat 文件必须纯 ASCII**：中文注释会因 GBK/UTF-8 解码错乱导致 `cd /d` 等语句失效
（task-72 实测踩坑：中文 bat 里 `cd /d` 未生效，cwd 停在脚本目录，
`--import ./tester/...` 相对路径随之失效，报 ERR_MODULE_NOT_FOUND —— 极易误判成产品问题）。

### SSH 取码

```bash
# ⚠️ 必须区分「连不上」与「远端失败」
sshpass -e ssh "$H" 'cmd' > out.txt 2>&1; rc=$?
case $rc in
  5|255) echo "SSH_FAIL=$rc（连接/认证失败，非被测失败）";;
  *)     echo "REMOTE_EXIT=$rc";;
esac
```

## 三、审计器

`tester/audit/exitcode-audit.sh`（bash，仅本地容器可跑；服务器无 bash）

```bash
bash tester/audit/exitcode-audit.sh --selftest        # 规则17：先自证方言
bash tester/audit/exitcode-audit.sh <dir-or-file>...  # 正式扫描（自动先自证）
```

**5 个检测模式**：①同行管道+取码 ②紧邻行 ③cmd 单行 `&` 串联 ④ssh 取码未区分连接失败 ⑤硬写 IP

**规则 17 自证**：内置 5 个必然命中的正例 + 1 个干净样本，
**每次正式扫描前自动跑**。若正例未命中 ⇒ 尺子失效 ⇒ 该次零命中不予采信。

### ⚠️ 规则 19：本审计器抓不到的（探测也有地板）

- 取码逻辑跨多行拼接，或经变量间接构造（`C="$c | grep x"; eval "$C"`）
- 在其它语言里取码（python `subprocess` / node `child_process`）
- 运行时才决定是否走管道
- **服务器侧无 bash ⇒ 只能在容器扫；服务器上新增的 .bat 不会被自动扫到**

⇒ **零命中 ≠ 全项目安全。** 它只覆盖「同行/紧邻行」的常见写法。

## 四、task-72 扫描结果（2026-08-05）

| 项 | 结果 |
|---|---|
| 取码类陷阱（模式①②③④）| **0 处** ✅ 与 Manager 人工逐行核对**交叉确认一致** |
| 硬写 IP（模式⑤）| **5 处** 🔴 全在 worker3 自己 INPUT-04 期归档脚本，**已脱敏为 `${HOST:?...}`** |
| 报告/日志类含明文 IP | **22 处**（w1:2 / w2:4 / w3:14 / mgr:2）**登记不改** —— 属历史取证原貌，且 IP 每 1~2 天变化、旧值已失效 |
