# Stream Feeds ForYou Group 全局推送项目

这个项目演示了如何使用 Stream Feeds 的 ForYou Group 功能来实现全局推送和个性化内容推荐。

## 项目结构

```
test-stream/
├── index.ts                 # 主应用文件（包含完整的 foryou 实现）
├── foryou-example.ts        # 简化的 ForYou Group 示例
├── tokenProvider.ts         # 令牌生成和管理
├── FORYOU_GUIDE.md         # 详细使用指南
├── .env                    # 环境变量配置
├── .env.example            # 环境变量示例
└── package.json            # 项目依赖和脚本
```

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
复制 `.env.example` 到 `.env` 并填入你的 Stream 配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：
```
STREAM_API_KEY=your-stream-api-key
STREAM_API_SECRET=your-stream-api-secret
STREAM_APP_ID=your-stream-app-id
STREAM_USER_ID=your-user-id
TOKEN_VALIDITY_SECONDS=3600
```

### 3. 运行示例

#### 运行简化的 ForYou 示例
```bash
npm run foryou
```

#### 运行完整的应用
```bash
npm run dev
```

## 核心功能

### 1. ForYou Group 全局推送
- ✅ 创建用户专属的 foryou feed
- ✅ 添加全局推送内容
- ✅ 实时获取推荐内容
- ✅ 轮询监听新内容更新

### 2. 令牌管理
- ✅ 动态生成用户令牌
- ✅ 自动令牌刷新机制
- ✅ 令牌过期处理

### 3. 错误处理
- ✅ 网络超时处理
- ✅ 认证错误处理
- ✅ 资源清理机制

## 使用场景

### 全局公告推送
```typescript
await forYouManager.addGlobalPush({
  text: "🎉 系统维护通知：今晚 22:00-24:00",
  type: "system_announcement",
  priority: "high"
});
```

### 个性化内容推荐
```typescript
await forYouManager.addGlobalPush({
  text: "🔥 基于你的兴趣推荐：React 最佳实践",
  type: "content_recommendation",
  priority: "medium"
});
```

### 营销活动推送
```typescript
await forYouManager.addGlobalPush({
  text: "🛍️ 限时优惠：Stream 服务 8 折优惠",
  type: "promotion",
  priority: "low"
});
```

## API 使用示例

### 基本用法
```typescript
import { ForYouManager } from './foryou-example';

const forYouManager = new ForYouManager({
  apiKey: process.env.STREAM_API_KEY!,
  apiSecret: process.env.STREAM_API_SECRET!,
  userId: process.env.STREAM_USER_ID!
});

// 初始化
await forYouManager.initialize();

// 添加推送
await forYouManager.addGlobalPush({
  text: "欢迎使用 ForYou 功能！",
  type: "welcome"
});

// 获取推荐内容
const recommendations = await forYouManager.getRecommendations(10);
forYouManager.displayRecommendations(recommendations);
```

### 实时监听
```typescript
// 启动实时监听
const interval = forYouManager.startMonitoring(10000); // 每10秒检查一次

// 停止监听
clearInterval(interval);
forYouManager.cleanup();
```

## 文档

- 📖 [ForYou Group 详细使用指南](./FORYOU_GUIDE.md) - 完整的功能说明和最佳实践
- 💡 [示例代码](./foryou-example.ts) - 可运行的示例代码
- 🔧 [主应用](./index.ts) - 完整的实现示例

## 注意事项

1. **API Secret 安全**: 确保 `.env` 文件不会提交到版本控制系统
2. **网络配置**: 如果遇到超时错误，请检查网络连接和防火墙设置
3. **令牌有效期**: 建议设置合适的令牌有效期（默认 1 小时）
4. **监听频率**: 根据实际需求调整轮询间隔，避免过于频繁的 API 调用

## 故障排除

### 常见错误

#### 1. 超时错误
```
StreamApiError: timeout of 3000ms exceeded
```
**解决方案**: 检查网络连接和 API 配置，确保 API Secret 正确

#### 2. 认证错误
```
StreamApiError: 401 Unauthorized
```
**解决方案**: 检查 API Key 和 API Secret 是否正确配置

#### 3. 环境变量未设置
```
请确保在 .env 文件中配置了所有必需的环境变量
```
**解决方案**: 按照 `.env.example` 配置所有必需的环境变量

## 扩展功能

- [ ] 用户偏好设置
- [ ] 推送统计分析
- [ ] 内容分类和过滤
- [ ] 批量推送操作
- [ ] WebSocket 实时推送

## 技术栈

- **Stream Feeds**: 核心推送服务
- **TypeScript**: 类型安全的开发体验
- **Node.js**: 服务端运行环境
- **JWT**: 用户认证和授权
- **WebSocket**: 实时通信支持

## 许可证

MIT License