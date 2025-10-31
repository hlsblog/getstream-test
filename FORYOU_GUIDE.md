# Stream Feeds ForYou Group 全局推送使用指南

## 概述

ForYou Group 是 Stream Feeds 中用于实现全局推送和个性化内容推荐的重要功能。它允许您为用户创建个性化的内容流，实现类似社交媒体"为你推荐"的功能。

## 核心概念

### 1. ForYou Feed
- **类型**: `foryou`
- **用途**: 存储为特定用户推荐的全局内容
- **特点**: 可以包含来自不同来源的聚合内容

### 2. Feed 结构
```javascript
const foryouFeed = client.feed("foryou", userId);
```

## 实现功能

### 1. 创建 ForYou Feed
```javascript
// 为用户创建个性化推荐 feed
const foryouFeed = client.feed("foryou", config.userId);
await foryouFeed.getOrCreate({ watch: true });
```

### 2. 添加全局推送内容
```javascript
// 添加全局推送消息
const globalActivity = await foryouFeed.addActivity({
  text: "🎉 欢迎使用 Stream Feeds！这是一条全局推送消息。",
  type: "global_announcement"
});
```

### 3. 获取推荐内容
```javascript
// 获取用户的个性化推荐内容
const foryouContent = await foryouFeed.getOrCreate({ limit: 10 });
```

### 4. 实时监听更新
```javascript
// 使用轮询方式监听新内容
const monitorInterval = setInterval(async () => {
  const currentContent = await foryouFeed.getOrCreate({ limit: 10 });
  // 检查是否有新内容
}, 10000);
```

## 使用场景

### 1. 全局公告
- 系统维护通知
- 新功能发布
- 重要活动推广

### 2. 个性化推荐
- 基于用户兴趣的内容推荐
- 热门内容推送
- 相关用户动态

### 3. 营销推送
- 促销活动通知
- 产品推荐
- 用户引导

## 最佳实践

### 1. 内容分类
```javascript
// 使用 type 字段对内容进行分类
await foryouFeed.addActivity({
  text: "内容文本",
  type: "promotion",        // 促销
  // type: "announcement",  // 公告
  // type: "recommendation" // 推荐
});
```

### 2. 优先级管理
```javascript
// 使用自定义字段管理优先级
await foryouFeed.addActivity({
  text: "重要通知",
  type: "urgent_notice",
  priority: "high"
});
```

### 3. 用户分组
```javascript
// 为不同用户组创建不同的 foryou feed
const vipForyouFeed = client.feed("foryou_vip", userId);
const regularForyouFeed = client.feed("foryou_regular", userId);
```

## 配置要求

### 1. 环境变量
确保在 `.env` 文件中配置：
```
STREAM_API_KEY=your-api-key
STREAM_API_SECRET=your-api-secret
STREAM_USER_ID=user-id
```

### 2. 权限设置
在 Stream Dashboard 中确保：
- Feed 类型 `foryou` 已启用
- 用户有读写权限
- WebSocket 连接已启用

## 错误处理

### 1. 超时错误
```javascript
try {
  const content = await foryouFeed.getOrCreate({ limit: 10 });
} catch (error) {
  if (error.message.includes('timeout')) {
    console.log('请求超时，请检查网络连接和 API 配置');
  }
}
```

### 2. 认证错误
```javascript
try {
  await client.connectUser({ id: userId }, userToken);
} catch (error) {
  if (error.message.includes('401')) {
    console.log('认证失败，请检查 API Secret 和用户令牌');
  }
}
```

## 扩展功能

### 1. 批量操作
```javascript
// 批量添加多个推送内容
const activities = [
  { text: "消息1", type: "news" },
  { text: "消息2", type: "update" }
];

for (const activity of activities) {
  await foryouFeed.addActivity(activity);
}
```

### 2. 内容过滤
```javascript
// 根据用户偏好过滤内容
const userPreferences = getUserPreferences(userId);
const filteredContent = foryouContent.activities.filter(activity => 
  userPreferences.includes(activity.type)
);
```

### 3. 分析统计
```javascript
// 统计推送效果
const analytics = {
  totalPushes: foryouContent.activities.length,
  byType: foryouContent.activities.reduce((acc, activity) => {
    acc[activity.type] = (acc[activity.type] || 0) + 1;
    return acc;
  }, {})
};
```

## 注意事项

1. **API Secret 安全**: 确保 API Secret 不会暴露在客户端代码中
2. **令牌管理**: 定期刷新用户令牌以保证安全性
3. **内容审核**: 对全局推送内容进行适当的审核和过滤
4. **性能优化**: 合理设置轮询间隔，避免过于频繁的 API 调用
5. **用户体验**: 提供用户控制推送频率和类型的选项

## 下一步

1. 配置正确的 Stream API Secret
2. 测试不同类型的推送内容
3. 实现用户偏好设置
4. 添加推送统计和分析功能
5. 集成到实际应用中