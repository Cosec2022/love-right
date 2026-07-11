# 分析事件接口

引擎已经预留 `AnalyticsClient`，但默认关闭，不发送任何网络请求。

只有同时满足以下条件才会发送匿名事件：

```text
存在 LOVE_BAY_ANALYTICS_ENDPOINT
且本机 love-right:analytics-consent = granted
```

当前事件：

- `story_started`
- `choice_selected`
- `story_back`
- `story_completed`
- `story_reset`

建议后端只记录：

```text
匿名 session ID
story ID
scene ID / slot
choice ID
时间与完成耗时
```

不要默认收集姓名、联系方式、精确位置、聊天内容或用户的完整结果文本。

可由这些匿名事件计算：

- 开始率与完成率
- 每幕退出率
- 选项分布
- 路线完成率
- 返回修改率
- 平均完成时间
- 终局分布

后续增加分享与账户功能时，应单独设计隐私说明和删除机制，而不是把匿名剧情事件直接升级成个人档案。
