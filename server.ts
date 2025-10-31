import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { FeedsClient } from '@stream-io/feeds-client';
import WebSocket from 'ws';
import { StreamTokenProvider, TokenManager } from './tokenProvider';

// 加载环境变量
dotenv.config();

// WebSocket polyfill for Node.js
(global as any).WebSocket = WebSocket;

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Stream 配置
const streamConfig = {
  apiKey: process.env.STREAM_API_KEY!,
  apiSecret: process.env.STREAM_API_SECRET!,
};

// 验证配置
if (!streamConfig.apiKey || !streamConfig.apiSecret) {
  console.error('❌ 请确保在 .env 文件中配置了 STREAM_API_KEY 和 STREAM_API_SECRET');
  process.exit(1);
}

// Stream 客户端和令牌管理器（设置20秒超时）
const client = new FeedsClient(streamConfig.apiKey, { timeout: 20000 });
const tokenProvider = new StreamTokenProvider(streamConfig.apiKey, streamConfig.apiSecret);
const tokenManager = new TokenManager(tokenProvider);

// 用户令牌缓存和当前连接用户跟踪
const userTokens = new Map<string, string>();
let currentConnectedUser: string | null = null;

/**
 * 获取或创建用户令牌
 */
async function getUserToken(userId: string): Promise<string> {
  if (userTokens.has(userId)) {
    return userTokens.get(userId)!;
  }
  
  const token = await tokenManager.getValidToken(userId, 3600);
  userTokens.set(userId, token);
  return token;
}

/**
 * 连接用户到 Stream
 */
async function connectUser(userId: string): Promise<void> {
  // 如果当前已连接的用户与请求的用户不同，先断开连接
  if (currentConnectedUser && currentConnectedUser !== userId) {
    try {
      await client.disconnectUser();
      console.log(`🔌 已断开用户 ${currentConnectedUser} 的连接`);
    } catch (error) {
      console.warn('断开用户连接时出现警告:', error);
    }
    currentConnectedUser = null;
  }
  
  // 如果还没有连接当前用户，则连接
  if (currentConnectedUser !== userId) {
    const token = await getUserToken(userId);
    await client.connectUser({ id: userId }, token);
    currentConnectedUser = userId;
    console.log(`✅ 已连接用户 ${userId}`);
  }
}

// API 路由

/**
 * 获取用户 feed 内容
 */
app.get('/api/feeds/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const next = req.query.next as string;
    const prev = req.query.prev as string;
    
    await connectUser(userId);
    
    const userFeed = client.feed('user', userId);
    
    // 构建查询参数
    const queryParams: any = { limit };
    if (next) {
      queryParams.next = next;
    } else if (prev) {
      queryParams.prev = prev;
    }
    
    const content = await userFeed.getOrCreate(queryParams);
    
    res.json({
      success: true,
      data: {
        feedType: 'user',
        userId,
        activities: content.activities || [],
        total: content.activities?.length || 0,
        pagination: {
          next: content.next || null,
          prev: content.prev || null,
          hasNext: !!content.next,
          hasPrev: !!content.prev
        }
      }
    });
  } catch (error) {
    console.error('获取用户 feed 失败:', error);
    res.status(500).json({
      success: false,
      error: '获取用户 feed 失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 获取 foryou feed 内容
 */
app.get('/api/feeds/foryou/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const next = req.query.next as string;
    const prev = req.query.prev as string;
    
    await connectUser(userId);
    
    const foryouFeed = client.feed('foryou', userId);
    
    // 构建查询参数
    const queryParams: any = { limit };
    if (next) {
      queryParams.next = next;
    } else if (prev) {
      queryParams.prev = prev;
    }
    
    const content = await foryouFeed.getOrCreate(queryParams);
    
    res.json({
      success: true,
      data: {
        feedType: 'foryou',
        userId,
        activities: content.activities || [],
        total: content.activities?.length || 0,
        pagination: {
          next: content.next || null,
          prev: content.prev || null,
          hasNext: !!content.next,
          hasPrev: !!content.prev
        }
      }
    });
  } catch (error) {
    console.error('获取 foryou feed 失败:', error);
    res.status(500).json({
      success: false,
      error: '获取 foryou feed 失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 发布内容到用户 feed
 */
app.post('/api/feeds/user/:userId/post', async (req, res) => {
  try {
    const { userId } = req.params;
    const { text, type = 'post' } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: '内容不能为空'
      });
    }
    
    await connectUser(userId);
    
    const userFeed = client.feed('user', userId);
    const activity = await userFeed.addActivity({
      text,
      type
    });
    
    res.json({
      success: true,
      data: {
        message: '发布到用户 feed 成功',
        activity,
        feedType: 'user',
        userId
      }
    });
  } catch (error) {
    console.error('发布到用户 feed 失败:', error);
    res.status(500).json({
      success: false,
      error: '发布到用户 feed 失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 发布内容到 foryou feed
 */
app.post('/api/feeds/foryou/:userId/post', async (req, res) => {
  try {
    const { userId } = req.params;
    const { text, type = 'recommendation' } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: '内容不能为空'
      });
    }
    
    await connectUser(userId);
    
    const foryouFeed = client.feed('foryou', userId);
    const activity = await foryouFeed.addActivity({
      text,
      type
    });
    
    res.json({
      success: true,
      data: {
        message: '发布到 foryou feed 成功',
        activity,
        feedType: 'foryou',
        userId
      }
    });
  } catch (error) {
    console.error('发布到 foryou feed 失败:', error);
    res.status(500).json({
      success: false,
      error: '发布到 foryou feed 失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 同时发布到用户 feed 和 foryou feed
 */
app.post('/api/feeds/both/:userId/post', async (req, res) => {
  try {
    const { userId } = req.params;
    const { text, userType = 'post', foryouType = 'recommendation' } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: '内容不能为空'
      });
    }
    
    await connectUser(userId);
    
    const userFeed = client.feed('user', userId);
    const foryouFeed = client.feed('foryou', userId);
    
    // 同时发布到两个 feed
    const [userActivity, foryouActivity] = await Promise.all([
      userFeed.addActivity({ text, type: userType }),
      foryouFeed.addActivity({ text, type: foryouType })
    ]);
    
    res.json({
      success: true,
      data: {
        message: '同时发布到用户 feed 和 foryou feed 成功',
        userActivity,
        foryouActivity,
        userId
      }
    });
  } catch (error) {
    console.error('同时发布失败:', error);
    res.status(500).json({
      success: false,
      error: '同时发布失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 获取全局活动
 */
app.get('/api/activities/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const next = req.query.next as string;
    const prev = req.query.prev as string;
    
    await connectUser(userId);
    
    // 构建查询参数
    const queryParams: any = {
      filter: {
        activity_type: "post",
      },
      sort: [{ field: "created_at", direction: -1 }],
      limit: limit,
    };
    
    // 添加分页参数
    if (next) {
      queryParams.next = next;
    } else if (prev) {
      queryParams.prev = prev;
    }
    
    // 查询全局活动
    const activities = await client.queryActivities(queryParams);
    
    console.log('分页信息 - next:', activities.next, 'prev:', activities.prev);
    
    res.json({
      success: true,
      data: {
        feedType: 'activities',
        userId,
        activities: activities.activities || [],
        total: activities.activities?.length || 0,
        pagination: {
          next: activities.next || null,
          prev: activities.prev || null,
          hasNext: !!activities.next,
          hasPrev: !!activities.prev
        }
      }
    });
  } catch (error) {
    console.error('获取全局活动失败:', error);
    res.status(500).json({
      success: false,
      error: '获取全局活动失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 获取用户信息
 */
app.get('/api/user/:userId/info', async (req, res) => {
  try {
    const { userId } = req.params;
    
    await connectUser(userId);
    
    res.json({
      success: true,
      data: {
        userId,
        connected: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      error: '获取用户信息失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 断开用户连接
 */
app.post('/api/user/disconnect', async (req, res) => {
  try {
    if (currentConnectedUser) {
      await client.disconnectUser();
      console.log(`🔌 已断开用户 ${currentConnectedUser} 的连接`);
      const disconnectedUser = currentConnectedUser;
      currentConnectedUser = null;
      
      res.json({
        success: true,
        message: '用户连接已断开',
        data: {
          disconnectedUser,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.json({
        success: true,
        message: '当前没有连接的用户',
        data: {
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    console.error('断开用户连接失败:', error);
    res.status(500).json({
      success: false,
      error: '断开用户连接失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 关注用户 - 使用Stream SDK原生功能
 */
app.post('/api/user/:userId/follow/:targetUserId', async (req, res) => {
  try {
    const { userId, targetUserId } = req.params;
    
    if (userId === targetUserId) {
      return res.status(400).json({
        success: false,
        error: '不能关注自己'
      });
    }
    
    await connectUser(userId);
    
    // 使用Stream SDK的关注功能
    const followResult = await client.follow({
      source: `user:${userId}`,
      target: `user:${targetUserId}`,
      create_notification_activity: false
    });
    
    res.json({
      success: true,
      message: '关注成功',
      data: {
        userId,
        targetUserId,
        followResult,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('关注用户失败:', error);
    res.status(500).json({
      success: false,
      error: '关注用户失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 取消关注用户 - 使用Stream SDK原生功能
 */
app.delete('/api/user/:userId/follow/:targetUserId', async (req, res) => {
  try {
    const { userId, targetUserId } = req.params;
    
    await connectUser(userId);
    
    // 使用Stream SDK的取消关注功能
    const unfollowResult = await client.unfollow({
      source: `user:${userId}`,
      target: `user:${targetUserId}`
    });
    
    res.json({
      success: true,
      message: '取消关注成功',
      data: {
        userId,
        targetUserId,
        unfollowResult,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('取消关注失败:', error);
    res.status(500).json({
      success: false,
      error: '取消关注失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 检查关注状态 - 使用Stream SDK原生功能
 */
app.get('/api/user/:userId/follow/:targetUserId/status', async (req, res) => {
  try {
    const { userId, targetUserId } = req.params;
    
    await connectUser(userId);
    
    // 使用Stream SDK查询关注状态
    const followsResult = await client.queryFollows({
      filter: {
        source: `user:${userId}`,
        target: `user:${targetUserId}`
      },
      limit: 1
    });
    
    const isFollowing = followsResult.follows && followsResult.follows.length > 0;
    
    res.json({
      success: true,
      data: {
        userId,
        targetUserId,
        isFollowing,
        followInfo: followsResult.follows?.[0] || null,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('检查关注状态失败:', error);
    res.status(500).json({
      success: false,
      error: '检查关注状态失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 获取用户关注列表 - 使用Stream SDK原生功能
 */
app.get('/api/user/:userId/following', async (req, res) => {
  try {
    const { userId } = req.params;
    
    await connectUser(userId);
    
    // 使用Stream SDK查询用户的关注列表
    const followsResult = await client.queryFollows({
      limit: 100 // 可以根据需要调整限制
    });
    
    const followingList = followsResult.follows.map(follow => ({
      userId: follow.target_feed.id.replace('user:', ''),
      followedAt: follow.created_at,
      status: follow.status
    }));
    
    res.json({
      success: true,
      data: {
        userId,
        following: followingList,
        count: followingList.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取关注列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取关注列表失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 收藏活动 - 使用Stream SDK原生功能
 */
app.post('/api/user/:userId/bookmark/:activityId', async (req, res) => {
  try {
    const { userId, activityId } = req.params;
    const { folder_id, custom } = req.body;
    
    await connectUser(userId);
    
    // 使用Stream SDK的收藏功能
    const bookmarkResult = await client.addBookmark({
      activity_id: activityId,
      folder_id,
      custom
    });
    
    res.json({
      success: true,
      message: '收藏成功',
      data: {
        userId,
        activityId,
        bookmark: bookmarkResult.bookmark,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('收藏活动失败:', error);
    res.status(500).json({
      success: false,
      error: '收藏活动失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 取消收藏活动 - 使用Stream SDK原生功能
 */
app.delete('/api/user/:userId/bookmark/:activityId', async (req, res) => {
  try {
    const { userId, activityId } = req.params;
    const { folder_id } = req.query;
    
    await connectUser(userId);
    
    // 使用Stream SDK的取消收藏功能
    const unbookmarkResult = await client.deleteBookmark({
      activity_id: activityId,
      folder_id: folder_id as string
    });
    
    res.json({
      success: true,
      message: '取消收藏成功',
      data: {
        userId,
        activityId,
        unbookmarkResult,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('取消收藏失败:', error);
    res.status(500).json({
      success: false,
      error: '取消收藏失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 获取用户收藏列表 - 使用Stream SDK原生功能
 */
app.get('/api/user/:userId/bookmarks', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, next, prev, folder_id } = req.query;
    
    await connectUser(userId);
    
    // 构建查询参数
    const queryParams: any = {
      limit: parseInt(limit as string),
      filter: {
        user_id: userId
      }
    };
    
    if (next) queryParams.next = next as string;
    if (prev) queryParams.prev = prev as string;
    if (folder_id) queryParams.filter.folder_id = folder_id as string;
    
    // 使用Stream SDK查询用户的收藏列表
    const bookmarksResult = await client.queryBookmarks(queryParams);
    
    // 将收藏数据转换为与Feed API一致的格式
    const activities = (bookmarksResult.bookmarks || []).map(bookmark => {
      // 确保每个收藏都有对应的活动数据
      if (bookmark.activity) {
        return {
          id: bookmark.activity.id,
          text: bookmark.activity.text || '无文本内容',
          type: bookmark.activity.type || 'post',
          time: bookmark.activity.created_at || bookmark.created_at || new Date().toISOString(),
          user: bookmark.activity.user || bookmark.user || { id: userId },
          // 保留原始收藏信息
          bookmark_info: {
            created_at: bookmark.created_at,
            updated_at: bookmark.updated_at,
            folder: bookmark.folder
          }
        };
      }
      return null;
    }).filter(Boolean); // 过滤掉null值
    
    res.json({
      success: true,
      data: {
        userId,
        activities: activities, // 使用activities字段以保持与其他Feed API的一致性
        total: activities.length,
        pagination: {
          next: bookmarksResult.next || null,
          prev: bookmarksResult.prev || null,
          hasNext: !!bookmarksResult.next,
          hasPrev: !!bookmarksResult.prev
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取收藏列表失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 检查活动收藏状态 - 使用Stream SDK原生功能
 */
app.get('/api/user/:userId/bookmark/:activityId/status', async (req, res) => {
  try {
    const { userId, activityId } = req.params;
    
    await connectUser(userId);
    
    // 使用Stream SDK查询收藏状态
    const bookmarksResult = await client.queryBookmarks({
      filter: {
        user_id: userId,
        activity_id: activityId
      },
      limit: 1
    });
    
    const isBookmarked = bookmarksResult.bookmarks && bookmarksResult.bookmarks.length > 0;
    
    res.json({
      success: true,
      data: {
        userId,
        activityId,
        isBookmarked,
        bookmarkInfo: bookmarksResult.bookmarks?.[0] || null,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('检查收藏状态失败:', error);
    res.status(500).json({
      success: false,
      error: '检查收藏状态失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 点赞活动 - 使用Stream SDK原生功能
 */
app.post('/api/user/:userId/like/:activityId', async (req, res) => {
  try {
    const { userId, activityId } = req.params;
    const { custom } = req.body;
    
    await connectUser(userId);
    
    // 使用Stream SDK的点赞功能
    const likeResult = await client.addActivityReaction({
      activity_id: activityId,
      type: 'like',
      create_notification_activity: false,
      enforce_unique: true, // 确保每个用户只能点赞一次
      skip_push: true,
      custom
    });
    
    res.json({
      success: true,
      message: '点赞成功',
      data: {
        userId,
        activityId,
        reaction: likeResult.reaction,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('点赞活动失败:', error);
    res.status(500).json({
      success: false,
      error: '点赞活动失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 取消点赞活动 - 使用Stream SDK原生功能
 */
app.delete('/api/user/:userId/like/:activityId', async (req, res) => {
  try {
    const { userId, activityId } = req.params;
    
    await connectUser(userId);
    
    // 使用Stream SDK的取消点赞功能
    const unlikeResult = await client.deleteActivityReaction({
      activity_id: activityId,
      type: 'like'
    });
    
    res.json({
      success: true,
      message: '取消点赞成功',
      data: {
        userId,
        activityId,
        unlikeResult,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('取消点赞失败:', error);
    res.status(500).json({
      success: false,
      error: '取消点赞失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 检查用户对活动的点赞状态 - 使用Stream SDK原生功能
 */
app.get('/api/user/:userId/like/:activityId/status', async (req, res) => {
  try {
    const { userId, activityId } = req.params;
    
    await connectUser(userId);
    
    // 使用Stream SDK查询点赞状态
    const reactionsResult = await client.queryActivityReactions({
      activity_id: activityId,
      limit: 100 // 增加限制以获取更多数据
    });
    
    // 在代码中过滤出当前用户的点赞记录
    const isLiked = (reactionsResult.reactions || [])
      .some((reaction: any) => reaction.type === 'like' && reaction.user_id === userId);
    
    res.json({
      success: true,
      data: {
        userId,
        activityId,
        isLiked,
        likeInfo: reactionsResult.reactions?.[0] || null,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('检查点赞状态失败:', error);
    res.status(500).json({
      success: false,
      error: '检查点赞状态失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 获取活动的点赞列表 - 使用Stream SDK原生功能
 */
app.get('/api/activity/:activityId/likes', async (req, res) => {
  try {
    const { activityId } = req.params;
    const { limit = 20, next, prev } = req.query;
    
    // 注意：这里不需要connectUser，因为查询点赞列表是公开的
    
    // 构建查询参数 - 移除filter，查询所有reactions然后过滤
    const queryParams: any = {
      activity_id: activityId,
      limit: parseInt(limit as string),
      sort: [{ field: 'created_at', direction: -1 }] // 按时间倒序
    };
    
    if (next) queryParams.next = next as string;
    if (prev) queryParams.prev = prev as string;
    
    // 使用Stream SDK查询活动的点赞列表
    const reactionsResult = await client.queryActivityReactions(queryParams);
    
    // 过滤出点赞类型的reactions并转换数据格式
    const likes = (reactionsResult.reactions || [])
      .filter((reaction: any) => reaction.type === 'like')
      .map((reaction: any) => ({
        id: reaction.id,
        userId: reaction.user_id,
        createdAt: reaction.created_at,
        custom: reaction.custom || {}
      }));
    
    res.json({
      success: true,
      data: {
        activityId,
        likes,
        total: likes.length,
        pagination: {
          next: reactionsResult.next || null,
          prev: reactionsResult.prev || null,
          hasNext: !!reactionsResult.next,
          hasPrev: !!reactionsResult.prev
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取点赞列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取点赞列表失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 获取活动的点赞数量 - 使用Stream SDK原生功能
 */
app.get('/api/activity/:activityId/likes/count', async (req, res) => {
  try {
    const { activityId } = req.params;
    
    // 查询所有reactions然后过滤点赞
    const reactionsResult = await client.queryActivityReactions({
      activity_id: activityId,
      limit: 100 // 获取更多数据来计算准确的点赞数量
    });
    
    // 过滤出点赞类型的reactions并计算数量
    const likeCount = (reactionsResult.reactions || [])
      .filter((reaction: any) => reaction.type === 'like').length;
    
    res.json({
      success: true,
      data: {
        activityId,
        likeCount,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取点赞数量失败:', error);
    res.status(500).json({
      success: false,
      error: '获取点赞数量失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

// ==================== 评论相关 API ====================

/**
 * 为活动添加评论
 */
app.post('/api/activity/:activityId/comments', async (req, res) => {
  try {
    const { activityId } = req.params;
    const { userId, comment } = req.body;
    
    if (!userId || !comment) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数',
        message: '需要提供 userId 和 comment'
      });
    }
    
    await connectUser(userId);
    
    const commentData = {
      object_id: activityId,
      object_type: 'activity',
      comment: comment,
      custom: {
        user_id: userId,
        timestamp: new Date().toISOString()
      }
    };
    
    const result = await client.addComment(commentData);
    
    res.json({
      success: true,
      data: {
        comment: result.comment,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('添加评论失败:', error);
    res.status(500).json({
      success: false,
      error: '添加评论失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 获取活动的评论列表
 */
app.get('/api/activity/:activityId/comments', async (req, res) => {
  try {
    const { activityId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const next = req.query.next as string;
    const prev = req.query.prev as string;
    
    const queryParams: any = {
      filter: {
        object_id: activityId,
        object_type: 'activity'
      },
      limit,
      sort: 'first' // 按时间顺序排序，最早的在前
    };
    
    if (next) {
      queryParams.next = next;
    }
    if (prev) {
      queryParams.prev = prev;
    }
    
    const result = await client.queryComments(queryParams);
    
    res.json({
      success: true,
      data: {
        comments: result.comments || [],
        next: result.next,
        prev: result.prev,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取评论列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取评论列表失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 删除评论
 */
app.delete('/api/comments/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数',
        message: '需要提供 userId'
      });
    }
    
    await connectUser(userId);
    
    await client.deleteComment({ id: commentId });
    
    res.json({
      success: true,
      data: {
        commentId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('删除评论失败:', error);
    res.status(500).json({
      success: false,
      error: '删除评论失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 为评论点赞
 */
app.post('/api/user/:userId/like/comment/:commentId', async (req, res) => {
  try {
    const { userId, commentId } = req.params;
    
    await connectUser(userId);
    
    const reactionData = {
      id: commentId,
      type: 'like'
    };
    
    const result = await client.addCommentReaction(reactionData);
    
    res.json({
      success: true,
      data: {
        reaction: result.reaction,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('评论点赞失败:', error);
    res.status(500).json({
      success: false,
      error: '评论点赞失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 取消评论点赞
 */
app.delete('/api/user/:userId/like/comment/:commentId', async (req, res) => {
  try {
    const { userId, commentId } = req.params;
    
    await connectUser(userId);
    
    // 先查询用户对该评论的点赞记录
    const reactionsResult = await client.queryCommentReactions({
      id: commentId,
      limit: 100 // 增加限制以获取更多数据
    });
    
    // 找到点赞类型的reaction
    const likeReaction = (reactionsResult.reactions || [])
      .find((reaction: any) => reaction.type === 'like' && reaction.user_id === userId);
    
    if (!likeReaction) {
      return res.status(404).json({
        success: false,
        error: '未找到点赞记录',
        message: '用户未对该评论点赞'
      });
    }
    
    await client.deleteCommentReaction({
      id: commentId,
      type: 'like'
    });
    
    res.json({
      success: true,
      data: {
        commentId,
        userId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('取消评论点赞失败:', error);
    res.status(500).json({
      success: false,
      error: '取消评论点赞失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 检查用户是否对评论点赞
 */
app.get('/api/user/:userId/like/comment/:commentId/status', async (req, res) => {
  try {
    const { userId, commentId } = req.params;
    
    await connectUser(userId);
    
    const reactionsResult = await client.queryCommentReactions({
      id: commentId,
      limit: 100 // 增加限制以获取更多数据
    });
    
    const isLiked = (reactionsResult.reactions || [])
      .some((reaction: any) => reaction.type === 'like' && reaction.user_id === userId);
    
    res.json({
      success: true,
      data: {
        commentId,
        userId,
        isLiked,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('检查评论点赞状态失败:', error);
    res.status(500).json({
      success: false,
      error: '检查评论点赞状态失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 获取评论的点赞列表
 */
app.get('/api/comment/:commentId/likes', async (req, res) => {
  try {
    const { commentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const next = req.query.next as string;
    const prev = req.query.prev as string;
    
    const queryParams: any = {
      id: commentId,
      limit
    };
    
    if (next) {
      queryParams.next = next;
    }
    if (prev) {
      queryParams.prev = prev;
    }
    
    const reactionsResult = await client.queryCommentReactions(queryParams);
    
    // 过滤出点赞类型的reactions
    const likes = (reactionsResult.reactions || [])
      .filter((reaction: any) => reaction.type === 'like');
    
    res.json({
      success: true,
      data: {
        commentId,
        likes,
        next: reactionsResult.next,
        prev: reactionsResult.prev,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取评论点赞列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取评论点赞列表失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 获取评论的点赞数量
 */
app.get('/api/comment/:commentId/likes/count', async (req, res) => {
  try {
    const { commentId } = req.params;
    
    const reactionsResult = await client.queryCommentReactions({
      id: commentId,
      limit: 100 // 获取更多数据来计算准确的点赞数量
    });
    
    // 过滤出点赞类型的reactions并计算数量
    const likeCount = (reactionsResult.reactions || [])
      .filter((reaction: any) => reaction.type === 'like').length;
    
    res.json({
      success: true,
      data: {
        commentId,
        likeCount,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取评论点赞数量失败:', error);
    res.status(500).json({
      success: false,
      error: '获取评论点赞数量失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

// 提供静态文件
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📱 Web界面: http://localhost:${PORT}`);
  console.log(`🔧 API文档: http://localhost:${PORT}/api`);
});

export default app;