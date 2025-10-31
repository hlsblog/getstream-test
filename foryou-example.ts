import dotenv from 'dotenv';
import { FeedsClient } from '@stream-io/feeds-client';
import WebSocket from 'ws';
import { StreamTokenProvider, TokenManager } from './tokenProvider';

// 加载环境变量
dotenv.config();

// WebSocket polyfill for Node.js
(global as any).WebSocket = WebSocket;

/**
 * ForYou Group 全局推送示例
 * 
 * 这个示例展示了如何使用 Stream Feeds 的 foryou group 功能
 * 来实现全局推送和个性化内容推荐
 */

interface GlobalPushConfig {
  apiKey: string;
  apiSecret: string;
  userId: string;
}

class ForYouManager {
  private client: FeedsClient;
  private tokenManager: TokenManager;
  private userId: string;

  constructor(config: GlobalPushConfig) {
    this.client = new FeedsClient(config.apiKey);
    this.userId = config.userId;
    
    const tokenProvider = new StreamTokenProvider(config.apiKey, config.apiSecret);
    this.tokenManager = new TokenManager(tokenProvider);
  }

  /**
   * 初始化用户连接
   */
  async initialize(): Promise<void> {
    console.log("🔑 正在生成用户令牌...");
    const userToken = await this.tokenManager.getValidToken(this.userId, 3600);
    
    console.log("👤 正在连接用户...");
    await this.client.connectUser({ id: this.userId }, userToken);
    console.log("✅ 用户连接成功！");
  }

  /**
   * 获取用户的 ForYou Feed
   */
  getForYouFeed() {
    return this.client.feed("foryou", this.userId);
  }

  /**
   * 添加全局推送内容
   */
  async addGlobalPush(content: {
    text: string;
    type: string;
    priority?: 'high' | 'medium' | 'low';
    category?: string;
  }): Promise<any> {
    const foryouFeed = this.getForYouFeed();
    
    console.log(`📝 正在添加全局推送: ${content.text}`);
    
    const activity = await foryouFeed.addActivity({
      text: content.text,
      type: content.type
    });
    
    console.log("✅ 全局推送添加成功");
    return activity;
  }

  /**
   * 获取用户的推荐内容
   */
  async getRecommendations(limit: number = 10): Promise<any> {
    const foryouFeed = this.getForYouFeed();
    
    console.log("📖 正在获取推荐内容...");
    
    try {
      const content = await foryouFeed.getOrCreate({ limit });
      console.log(`✅ 获取到 ${content.activities?.length || 0} 条推荐内容`);
      return content;
    } catch (error) {
      console.error("❌ 获取推荐内容失败:", error);
      throw error;
    }
  }

  /**
   * 显示推荐内容
   */
  displayRecommendations(content: any): void {
    if (!content.activities || content.activities.length === 0) {
      console.log("📭 暂无推荐内容");
      return;
    }

    console.log("\n🌟 === 推荐内容 ===");
    content.activities.forEach((activity: any, index: number) => {
      console.log(`${index + 1}. [${activity.type}] ${activity.text || '无文本内容'}`);
      console.log(`   ⏰ 时间: ${new Date(activity.time).toLocaleString()}`);
      console.log("   ---");
    });
  }

  /**
   * 启动实时监听（简化版本）
   */
  startMonitoring(intervalMs: number = 30000): NodeJS.Timeout {
    console.log(`🔄 启动推送监听 (每 ${intervalMs/1000} 秒检查一次)...`);
    
    let lastCount = 0;
    
    return setInterval(async () => {
      try {
        const content = await this.getRecommendations(5);
        const currentCount = content.activities?.length || 0;
        
        if (currentCount > lastCount) {
          console.log("🔔 检测到新的推送内容！");
          const newActivities = content.activities?.slice(0, currentCount - lastCount);
          newActivities?.forEach((activity: any) => {
            console.log(`📢 新推送: [${activity.type}] ${activity.text}`);
          });
        }
        
        lastCount = currentCount;
      } catch (error) {
        console.error("❌ 监听过程中发生错误:", error);
      }
    }, intervalMs);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.tokenManager.clearToken();
    console.log("🧹 资源清理完成");
  }
}

/**
 * 使用示例
 */
async function demonstrateForYouGroup() {
  const config = {
    apiKey: process.env.STREAM_API_KEY!,
    apiSecret: process.env.STREAM_API_SECRET!,
    userId: process.env.STREAM_USER_ID!
  };

  // 验证配置
  if (!config.apiKey || !config.apiSecret || !config.userId) {
    console.error("❌ 请确保在 .env 文件中配置了所有必需的环境变量");
    return;
  }

  const forYouManager = new ForYouManager(config);

  try {
    // 初始化
    await forYouManager.initialize();

    // 添加一些示例推送内容
    await forYouManager.addGlobalPush({
      text: "🎉 欢迎使用 ForYou 推送功能！",
      type: "welcome",
      priority: "high",
      category: "announcement"
    });

    await forYouManager.addGlobalPush({
      text: "📱 新功能上线：实时推送通知",
      type: "feature_update",
      priority: "medium",
      category: "update"
    });

    await forYouManager.addGlobalPush({
      text: "🔥 热门内容推荐：Stream Feeds 最佳实践",
      type: "recommendation",
      priority: "low",
      category: "content"
    });

    // 获取并显示推荐内容
    const recommendations = await forYouManager.getRecommendations(10);
    forYouManager.displayRecommendations(recommendations);

    // 启动监听（在实际应用中，这通常在后台运行）
    const monitoringInterval = forYouManager.startMonitoring(10000);

    // 模拟运行一段时间后停止
    setTimeout(() => {
      console.log("\n🛑 停止监听...");
      clearInterval(monitoringInterval);
      forYouManager.cleanup();
      console.log("🎊 ForYou Group 演示完成！");
    }, 30000); // 30秒后停止

  } catch (error) {
    console.error("❌ 演示过程中发生错误:", error);
    forYouManager.cleanup();
  }
}

// 如果直接运行此文件，则执行演示
if (require.main === module) {
  demonstrateForYouGroup().catch(console.error);
}

export { ForYouManager, demonstrateForYouGroup };