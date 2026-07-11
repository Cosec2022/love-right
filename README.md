# Love Right

**Love Right** 是 CosecLab 的互动恋爱叙事与人格投射引擎。用户不是填写一份显性的问卷，而是在连续关系情境中作出选择；引擎记录选择在16维恋爱空间中的方向、强度、情境、前后变化和维度组合，再生成动态结果。

当前版本：`v0.4.2 · Memory-first Results`

## 当前内容

- Story 01 ·《那年夏天，风替他说了喜欢》
- Story 02 ·《最后一班地铁之前》——女性视角，职场慢热
- Story 03 ·《婚礼散场以后》——女性视角，旧识重逢
- Story 04 ·《她把你的名字写在杯套背面》——男性视角，都市相遇

三篇新增故事全部使用同一个运行时，没有复制前端页面。

## v0.4.2 重点

- 保留16维空间引擎，但不再把8个相近参数直接端给用户
- 结果首页只突出一个可复述的名称，例如“等一句确定的人”
- 新增一个核心矛盾、三个关键结论和四个关系动作
- 四个关系动作只用生活化文字表达，不显示百分比或进度条
- 证据压缩为三个关键剧情瞬间，按“靠近—不确定—承诺”形成完整心理叙事
- 详细结局、过往投射、未来三幕与适配对象继续保留
- 16维底层数据移入“研究模式”，默认不展开
- 分享文案改为结果名称、核心矛盾和适配对象，不再复制最高参数
- v0.4.1 的4篇故事、空间评分、分支与分布校准全部保留

## 项目结构

```text
love-right/
├── public/
│   ├── index.html
│   ├── app.css
│   ├── app/
│   │   ├── main.js
│   │   ├── engine/  # 含 result-compressor 结果压缩层
│   │   └── ui/
│   └── stories/
│       ├── catalog.json
│       ├── story-01/
│       ├── story-02/
│       ├── story-03/
│       └── story-04/
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

不要直接使用 `file://` 打开 `index.html`。模块与 JSON 内容包需要由本地服务器或 Cloudflare Worker 提供。

## 发布前检查

```bash
npm run check
```

检查包含：

```text
内容图与 Schema 校验
+ 静态前端契约
+ Story / Score / Result Engine 测试
+ 18幕完整路线
+ 返回状态回滚
+ 魅力偏好三次剧情回响
+ 男性目标故事
+ 记忆型结果标题与三个关键结论
+ 随机结果分布
+ 混合结果比例
+ A/B/C/D 固定路线区分度
```

## 创建下一篇故事

```bash
npm run new-story -- midnight-message "凌晨两点，他问你睡了吗"
```

脚手架会自动继承统一16维空间、结果指标和原型词汇。草稿必须扩展到18个槽位，并重新校准结果分布后才能改为 `published`。

## 部署

```bash
npm run deploy
```

正式域名：`love-right.coseclab.dev`

GitHub `main` 已连接 Cloudflare 时，正常工作流是：

```bash
git add .
git commit -m "feat: add story pack and spatial scoring"
git push
```

## 产品边界

Love Right 可以做强代入、强传播和动态叙事，但结果必须保持娱乐性与可能性表达。不得把结果包装成临床诊断、真实经历读取、忠诚度判断或确定的未来预言。
