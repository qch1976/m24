# m24 - 24 点微信小游戏

> 由 template（飞机射击示例）迭代改造而来，当前处于**准备阶段（骨架版）**。

## 一、项目类型

- 平台：微信小游戏
- `project.config.json` 中 `compileType: "game"`
- 基础库：`libVersion 3.15.2`

## 二、目录结构

```
m24/
├── audio/                            // 音频资源（复用 template，占位）
├── images/                           // 图片资源（复用 template，占位）
├── js/
│   ├── base/                         // template 通用基础类（保留复用）
│   │   ├── animation.js
│   │   ├── pool.js
│   │   └── sprite.js
│   ├── libs/                         // 事件库等（保留复用）
│   │   └── tinyemitter.js
│   ├── runtime/                      // 保留 music.js 作为音频管理
│   │   ├── background.js             // template 旧文件（供参考，未在 m24 主流程使用）
│   │   ├── gameinfo.js               // template 旧文件（供参考）
│   │   └── music.js                  // 音频管理器（保留）
│   ├── npc/                          // template 旧模块（保留供参考，可删除）
│   ├── player/                       // template 旧模块（保留供参考，可删除）
│   ├── core/                         // ✅ 24 点游戏核心逻辑
│   │   ├── GameCore.js
│   │   ├── NumberGenerator.js
│   │   ├── Calculator.js
│   │   ├── Solver.js
│   │   └── Timer.js
│   ├── ui/                           // ✅ UI 层：首页/游戏页/结果页
│   │   ├── UIManager.js
│   │   ├── PageRenderer.js
│   │   └── Components.js
│   ├── utils/                        // ✅ 工具层
│   │   ├── Storage.js
│   │   └── Helper.js
│   ├── data/                         // ✅ 数据/配置
│   │   ├── GameData.js
│   │   └── Config.js
│   ├── databus.js                    // template 旧文件（保留兼容 main.airplane.js）
│   ├── render.js                     // template 旧文件（保留）
│   ├── main.airplane.js              // 原飞机游戏入口备份
│   └── main.js                       // ✅ 24 点游戏入口
├── .eslintrc.js                      // 代码规范（保留）
├── game.js                           // 游戏入口，import ./js/main
├── game.json                         // 游戏运行时配置
├── project.config.json               // 项目配置
├── project.private.config.json       // 项目个人配置
└── README.md
```

## 三、改造点

1. **入口切换**：`game.js` → `./js/main`（新 m24 主入口），原飞机 `main.js` 备份为 `main.airplane.js`
2. **新增 js/core**：GameCore / NumberGenerator / Calculator / Solver / Timer
3. **新增 js/ui**：UIManager + PageRenderer（首页/游戏页/结果页）+ Components
4. **新增 js/utils**：Storage / Helper
5. **新增 js/data**：GameData / Config
6. **保留复用**：`js/base/*`（精灵/对象池/动画基类）、`js/libs/tinyemitter.js`、`js/runtime/music.js`（音频管理）
7. **兼容**：template 旧目录 `npc/`、`player/`、`runtime/background|gameinfo`、`databus.js`、`render.js` 暂保留以便回滚查阅，不再被新入口引用
8. **配置**：`project.config.json.projectname` 更新为 `"m24"`，其余保持不变

## 四、导入微信开发者工具

1. 打开开发者工具 → 新建/导入项目
2. 项目类型：**小游戏**
3. 目录：本项目根目录（含 game.js / game.json）
4. AppID：使用 `project.config.json` 中的 `wx4e0efde8d1e3e6e9`（或替换成自己的）
5. 点击编译，即可看到首页三个按钮

## 五、下一步

按 `05-开发与测试Backlog.md` 的 Sprint 2/3/4 继续：
- Solver 完善并接入 NumberGenerator，确保题目一定有解
- Calculator 表达式栈与求值
- PageRenderer 中的数字选择/运算符选择交互
- Audio/Share 完整功能与资源接入
