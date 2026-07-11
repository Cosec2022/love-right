# Love Right Engine Architecture

## 1. 内容与运行时分离

每篇故事由两个独立内容包组成：

```text
story.json    场景、分支、状态、16维答案向量
results.json  指标、结果原型、动态报告规则
```

前端不包含任何 Story 01、02、03 或04的专用业务逻辑。故事库通过 `catalog.json` 加载内容包。

## 2. Story Engine

负责：

- 场景图与条件跳转
- flags 与人物路线记忆
- 18个 assessment slot
- 多人物、多结局与拒绝路线
- 返回上一幕时完整回滚答案、flags、向量和当前位置
- `localStorage` 本机续玩
- 记录每次选择的 vector、context、intensity、confidence 和 cross

## 3. Score Engine

Score Engine 将具名向量编译成内部空间数组：

```text
answerMatrix: Float64Array[18][16]
contextProfiles: 6 × 16
interaction: 16 × 16
trajectory: 18 × 16
```

输出包括：

- `profile`：16维最终位置
- `contextProfiles`：不同情境下的位置
- `variance` / `consistency`：是否反复摇摆
- `trend`：后半段相对前半段的变化
- `interaction`：维度共同出现关系
- `traits`：映射到8—92的页面分数

## 4. 隐含魅力偏好

每篇故事可以在自然情境中记录：

```json
"setFlags": {"appeal": "gentle"}
```

这不是让用户直接挑选“你喜欢哪种男主”，而是从她最先注意的行为细节中推断偏好。该 flag 在后文至少三次回响：

```text
早期：第6幕的靠近方式
中段：第12幕的关系表达
后段：第17幕的关键行动
结果：适合对象描述
```

故事的主事件和测量长度不变，但人物语言、行动和节奏会更接近用户刚刚表现出的类型偏好。

## 5. Result Engine

Result Engine 负责：

1. 对8种原型计算空间匹配分。
2. 应用准入/惩罚规则和 bias。
3. 判断是否允许混合结果。
4. 根据 outcome、traits、flags、answers 和 archetype 拼装报告。
5. 从最有解释力的答案生成“为什么这样判断”。

结果报告由以下模块组成：

```text
故事结局
恋爱心理
8个可读参数
关键选择证据
过去模式推演
未来三幕
适配对象
误判信号
16项底层分数
```

## 6. 质量门槛

```bash
npm run validate
npm test
npm run audit
npm run check
```

发布检查覆盖：

- 断路、死循环、不可达场景
- 未知轴与非法向量
- 所有路线18个答案完成
- 返回状态回滚
- 魅力偏好在第6、12、17幕正确出现
- 男性目标故事存在
- 固定路线区分度
- 主结果分布与混合比例
