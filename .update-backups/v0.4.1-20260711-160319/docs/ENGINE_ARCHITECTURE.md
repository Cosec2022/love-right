# Love Right 引擎架构

## 1. 内容与运行时分离

每篇故事由两个内容包组成：

```text
story.json    剧情、分支、选择、状态与评分影响
results.json  派生指标、人格原型与动态结果规则
```

前端不包含任何 Story 01 专用逻辑。新增故事时，运行时、样式和评分代码都不需要复制。

## 2. Story Engine

`StoryEngine` 负责：

- 读取当前场景
- 接受一个选择
- 累加底层维度原始分
- 写入或撤销剧情标记
- 解析直接跳转或条件跳转
- 保存完整选择记录
- 返回上一幕并恢复当时的所有状态
- 将进度保存到 `localStorage`

状态结构：

```json
{
  "currentSceneId": "s03_new_lead",
  "answers": [],
  "rawTraits": {},
  "flags": {"route": "newLead"},
  "visited": [],
  "outcome": null,
  "complete": false,
  "history": []
}
```

## 3. 场景图

每个选择可以：

```json
{
  "effects": {"spark": 2, "discernment": -1},
  "setFlags": {"route": "newLead"},
  "outcome": "clarify",
  "next": "s04_message"
}
```

也可以使用条件跳转：

```json
{
  "cases": [
    {"when": {"flag": "route", "equals": "newLead"}, "to": "s14_new_lead"}
  ],
  "default": "s14_original"
}
```

终点固定写成：

```json
"next": "$result"
```

## 4. Assessment Slot

同一剧情位置可能存在多个分支版本，但它们使用相同的 `slot`。例如：

```text
slot 03
├── 原人物共伞
├── 尊重边界后的两把伞
└── 新人物旧书店借伞
```

评分归一化按 slot 计算理论最大影响，因此不同路线仍然可以比较，不会因为某条路线多了一幕就天然得分更高。

## 5. Score Engine

底层分数：

```text
标准分 = center + spread × 原始分 / 该维度理论最大绝对值
```

默认输出限制在 `8—92`，避免制造绝对的 0 或 100。

派生指标由多个维度加权平均，也支持反向维度：

```json
{
  "label": "心动速度",
  "components": [
    {"trait": "spark"},
    {"trait": "novelty"},
    {"trait": "discernment", "inverse": true}
  ]
}
```

## 6. Result Engine

结果由规则拼装，而不是从八份固定文案中整份抽取：

```text
人格原型
+ 终局选择
+ 高低维度修饰
+ 过去模式规则
+ 未来三幕规则
+ 适配对象规则
+ 风险提醒规则
```

条件语法支持：

- `all` / `any` / `not`
- `trait` / `rawTrait` / `meter`
- `flag`
- `answer`
- `outcome`
- `archetype`
- `gte` / `lte` / `equals` / `in`

## 7. 校验层

`npm run validate` 会检查：

- 内容包、结果包和目录 ID 是否一致
- 场景 ID 与选择 ID 是否重复
- 评分是否引用未知维度
- 跳转目标是否存在
- 是否有不可达场景
- 是否有场景无法走到结果
- slot 是否连续
- 结果规则是否引用未知维度

这让批量生成故事时，格式正确不再依赖人工逐项排查。
