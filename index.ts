import dotenv from 'dotenv';
import { FeedsClient } from '@stream-io/feeds-client';
import WebSocket from 'ws';
import { StreamTokenProvider, TokenManager } from './tokenProvider';

// 加载环境变量
dotenv.config();

// WebSocket polyfill for Node.js
(global as any).WebSocket = WebSocket;

interface Config {
  apiKey: string;
  apiSecret: string;
  userId: string;
  tokenValiditySeconds: number;
}

function validateConfig(): Config {
  const apiKey = process.env.STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;
  const userId = 'linson';
  const tokenValiditySeconds = parseInt(process.env.TOKEN_VALIDITY_SECONDS || '3600');

  console.log('环境变量检查:');
  console.log('- API Key:', apiKey ? `${apiKey.substring(0, 8)}...` : '未设置');
  console.log('- API Secret:', apiSecret ? `${apiSecret.substring(0, 8)}...` : '未设置');
  console.log('- User ID:', userId || '未设置');
  console.log('- Token Validity:', `${tokenValiditySeconds}秒`);

  if (!apiKey) {
    throw new Error('STREAM_API_KEY 环境变量未设置。请在 .env 文件中设置您的 Stream API Key。');
  }

  if (!apiSecret) {
    throw new Error('STREAM_API_SECRET 环境变量未设置。请在 .env 文件中设置您的 Stream API Secret。');
  }

  if (!userId) {
    throw new Error('STREAM_USER_ID 环境变量未设置。请在 .env 文件中设置用户 ID。');
  }

  return { apiKey, apiSecret, userId, tokenValiditySeconds };
}

async function main() {
  try {
    console.log("🚀 开始运行 Stream Feeds 项目...\n");
    
    // 验证配置
    const config = validateConfig();
    
    console.log("\n📡 正在初始化 Stream Feeds 客户端...");
    
    // 初始化客户端
    const client = new FeedsClient(config.apiKey, {timeout: 10000});
    
    // 初始化令牌提供者
     const tokenProvider = new StreamTokenProvider(config.apiKey, config.apiSecret);
     const tokenManager = new TokenManager(tokenProvider);
     
     // 设置令牌刷新回调
     tokenManager.setRefreshCallback((newToken: string) => {
       console.log("🔄 令牌已自动刷新！");
       // 在实际应用中，这里可能需要重新连接客户端
       // 目前只是记录日志
     });
     
     // 生成用户令牌
     console.log("🔑 正在生成用户令牌...");
     const userToken = await tokenManager.getValidToken(config.userId, config.tokenValiditySeconds);
     console.log("✅ 用户令牌生成成功！");
     
     console.log(`👤 正在连接用户: ${config.userId}`);
     await client.connectUser({ id: config.userId }, userToken);
     console.log("✅ 用户连接成功！");
     
     // 启动令牌刷新监控（每5分钟检查一次）
     const refreshInterval = setInterval(async () => {
       try {
         console.log("🔍 检查令牌状态...");
         const currentToken = await tokenManager.getValidToken(config.userId, config.tokenValiditySeconds);
         if (currentToken !== userToken) {
           console.log("🔄 检测到令牌已更新");
         }
       } catch (error) {
         console.error("❌ 令牌刷新检查失败:", error);
       }
     }, 5 * 60 * 1000); // 5分钟
     
     // 确保在程序退出时清理定时器
     process.on('SIGINT', () => {
       console.log("\n🛑 正在清理资源...");
       clearInterval(refreshInterval);
       tokenManager.clearToken();
       process.exit(0);
     });
    
    // 创建或获取用户 feed
    console.log("📋 正在创建/获取用户 feed...");
    const userFeed = client.feed("user", config.userId);
    
    // 创建或获取 foryou feed（全局推送 feed）
    console.log("🌍 正在创建/获取 foryou feed...");
    const foryouFeed = client.feed("foryou", config.userId);
    
    // 订阅 foryou feed 的 WebSocket 事件以获取实时推送
    // console.log("🔌 正在订阅 foryou feed WebSocket 事件...");
    // await foryouFeed.getOrCreate({ watch: true });
    // console.log("✅ foryou feed WebSocket 连接成功！");
    
    // 演示：向全局推送添加内容（模拟管理员发布全局消息）
    //  console.log("📝 正在添加全局推送内容...");
    //  const globalActivity = await foryouFeed.addActivity({
    //    text: "🎉 欢迎使用 Stream Feeds！这是一条全局推送消息。",
    //    type: "global_announcement"
    //  });
    //  console.log("✅ 全局推送内容添加成功:", globalActivity);
     
     // 获取 foryou feed 中的内容
     console.log("📖 正在获取 foryou feed 内容...");
     const foryouContent = await foryouFeed.getOrCreate({ limit: 10 });
     console.log("✅ foryou feed 内容:", foryouContent?.activities || '暂无内容');
     
     // 显示全局推送内容
     if (foryouContent.activities && foryouContent.activities.length > 0) {
       console.log("\n🌟 === 全局推送内容 ===");
       foryouContent.activities.forEach((activity: any, index: number) => {
         console.log(`${index + 1}. [${activity.type}] ${activity.text || '无文本内容'}`);
         if (activity.extra_data) {
           console.log(`   📊 额外数据:`, activity.extra_data);
         }
         console.log(`   ⏰ 时间: ${new Date(activity.time).toLocaleString()}`);
         console.log("   ---");
       });
     } else {
       console.log("📭 foryou feed 暂无内容");
     }
     
     // 演示用户 feed 操作
    //  console.log("\n👤 正在操作用户 feed...");
    //  const userActivity = await userFeed.addActivity({
    //    text: "用户发布的内容",
    //    type: "post"
    //  });
    //  console.log("✅ 用户活动添加成功:", userActivity);
     
    //  // 获取用户 feed 内容
    //  console.log("📖 正在获取用户 feed 内容...");
    //  const userContent = await userFeed.getOrCreate({ limit: 5 });
    //  console.log("✅ 用户 feed 内容:", userContent);
     
    //  // 演示如何监听 feed 更新（使用轮询方式）
    //  console.log("\n🔄 启动 foryou feed 监听...");
    //  let lastActivityCount = foryouContent.activities ? foryouContent.activities.length : 0;
     
    //  const monitorInterval = setInterval(async () => {
    //    try {
    //      const currentContent = await foryouFeed.getOrCreate({ limit: 10 });
    //      const currentCount = currentContent.activities ? currentContent.activities.length : 0;
         
    //      if (currentCount > lastActivityCount) {
    //        console.log("🔔 检测到新的全局推送内容！");
    //        const newActivities = currentContent.activities?.slice(0, currentCount - lastActivityCount);
    //        newActivities?.forEach((activity: any) => {
    //          console.log(`📢 新推送: [${activity.type}] ${activity.text || '无文本内容'}`);
    //        });
    //        lastActivityCount = currentCount;
    //      }
    //    } catch (error) {
    //      console.error("❌ 监听 foryou feed 失败:", error);
    //    }
    //  }, 10000); // 每10秒检查一次
     
     // 添加到清理函数中
    //   const originalHandler = process.listeners('SIGINT')[0];
    //   process.removeAllListeners('SIGINT');
    //   process.on('SIGINT', () => {
    //     console.log("\n🛑 正在清理资源...");
    //     clearInterval(monitorInterval);
    //     if (typeof originalHandler === 'function') {
    //       (originalHandler as any)();
    //     }
    //   });

    console.log("\n🎊 Stream Feeds foryou group 全局推送功能运行成功！");
    
  } catch (error: any) {
    console.error("\n❌ 运行时发生错误:");
    
    if (error.message && error.message.includes("WS connection")) {
      console.error("🔌 WebSocket 连接失败，可能的原因：");
      console.error("   1. API 密钥无效");
      console.error("   2. 用户令牌无效");
      console.error("   3. 网络连接问题");
      console.error("   4. Stream 服务暂时不可用");
    } else if (error.message && error.message.includes("401")) {
      console.error("🔐 认证失败，请检查 API 密钥和用户令牌是否正确");
    } else {
      console.error("📋 详细错误信息:", error);
    }
    
    process.exit(1);
  }
}

// 运行主函数
main().catch((error) => {
  console.error("未捕获的错误:", error);
  process.exit(1);
});