# Love Right

**Love Right** 是 CosecLab 的互动恋爱叙事与人格投射引擎。它不再是一份写死在单个 HTML 里的测试，而是一套可以持续增加故事内容包的产品骨架。

当前版本：`v0.2.0 · Engine Alpha`

## 已经具备

- 故事目录与独立内容包
- 场景图、真实条件分支、人物路线切换与多结局
- 选择效果、状态标记、返回回滚和本机续玩
- 12项底层维度、派生指标和原型匹配
- 规则驱动的动态结果拼装
- “为什么这样判断”的关键选择证据
- 内容图验证：重复 ID、断路、不可达场景、无法到达结局、未知维度
- 新故事脚手架与批量生成契约
- Story 01 已从旧单页迁移到引擎

## 项目结构

```text
love-right/
├── public/
│   ├── index.html
│   ├── app.css
│   ├── app/
│   │   ├── main.js
│   │   ├── engine/
│   │   └── ui/
│   └── stories/
│       ├── catalog.json
│       └── story-01/
│           ├── story.json
│           └── results.json
├── schemas/
├── scripts/
├── tests/
└── docs/
```

## 本地运行

```bash
npm install
npm run dev
```

不要直接用 `file://` 打开 `index.html`，模块和 JSON 内容包需要通过本地服务器读取。

## 检查

```bash
npm run check
```

当前检查包含：

```text
内容与分支图验证
+ 引擎单元测试
+ 拒绝路线回归测试
+ 完整18幕结果测试
```

## 创建下一篇故事

```bash
npm run new-story -- midnight-message "凌晨两点，他问你睡了吗"
```

这会生成：

```text
public/stories/midnight-message/story.json
public/stories/midnight-message/results.json
```

并将草稿登记到 `catalog.json`。草稿不会显示在故事库；完成后把目录项和内容包的 `status` 改为 `published`。

## 部署

```bash
npm run deploy
```

预设域名：`love-right.coseclab.dev`

## 产品边界

Love Right 可以做强代入、强传播和动态叙事，但结果必须保持娱乐性与可能性表达。不得把内容包装成临床诊断、真实经历读取或确定的未来预测。
