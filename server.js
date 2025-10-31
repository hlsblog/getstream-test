const express = require('express');
const cors = require('cors');
const path = require('path');
const stream = require('getstream');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 提供Stream配置的API端点（只返回公开信息）
app.get('/api/stream-config', (req, res) => {
    try {
        // 只返回前端需要的公开配置信息
        const config = {
            apiKey: process.env.GETSTREAM_API_KEY,
            appId: process.env.GETSTREAM_APP_ID,
            // 注意：不要返回API secret，这应该只在服务器端使用
        };

        // 验证必要的环境变量是否存在
        if (!config.apiKey || !config.appId) {
            return res.status(500).json({
                error: '服务器配置错误：缺少必要的Stream配置'
            });
        }

        res.json(config);
    } catch (error) {
        console.error('获取Stream配置失败:', error);
        res.status(500).json({
            error: '获取配置失败'
        });
    }
});

// 生成用户token的API端点
app.post('/api/generate-token', (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                error: '缺少用户ID'
            });
        }

        // 在实际应用中，这里应该使用Stream的服务器端SDK来生成真实的JWT token
        // 现在我们使用getstream包来生成token
        const stream = require('getstream');
        const client = stream.connect(
            process.env.GETSTREAM_API_KEY,
            process.env.GETSTREAM_API_SECRET
        );
        
        const userToken = client.createUserToken(userId);
        
        res.json({
            token: userToken,
            userId: userId
        });
    } catch (error) {
        console.error('生成用户token失败:', error);
        res.status(500).json({
            error: '生成token失败'
        });
    }
});

// 创建示例活动的API端点
app.post('/api/create-sample-activity', async (req, res) => {
    try {
        const { userId, userToken } = req.body;
        
        if (!userId || !userToken) {
            return res.status(400).json({
                error: '缺少必要参数'
            });
        }

        const stream = require('getstream');
        const client = stream.connect(
            process.env.GETSTREAM_API_KEY,
            userToken,
            process.env.GETSTREAM_APP_ID
        );
        
        const userFeed = client.feed('user', userId);
        
        // 创建示例活动
        const activity = {
            actor: userId,
            verb: 'post',
            object: `photo:${Date.now()}`,
            foreign_id: `photo:${Date.now()}`,
            message: `${userId} 分享了一张新照片！`,
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=250&fit=crop',
            time: new Date().toISOString()
        };
        
        const result = await userFeed.addActivity(activity);
        
        res.json({
            success: true,
            activity: result
        });
    } catch (error) {
        console.error('创建示例活动失败:', error);
        res.status(500).json({
            error: '创建活动失败'
        });
    }
});

// 获取用户feed的API端点
app.get('/api/user-feed/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { userToken } = req.query;
        
        if (!userId || !userToken) {
            return res.status(400).json({
                error: '缺少必要参数'
            });
        }

        const stream = require('getstream');
        const client = stream.connect(
            process.env.GETSTREAM_API_KEY,
            userToken,
            process.env.GETSTREAM_APP_ID
        );
        
        const timelineFeed = client.feed('timeline', userId);
        const response = await timelineFeed.get({ limit: 20 });
        
        res.json({
            activities: response.results || []
        });
    } catch (error) {
        console.error('获取用户feed失败:', error);
        res.status(500).json({
            error: '获取feed失败',
            activities: []
        });
    }
});

// 关注用户的API端点
app.post('/api/follow', async (req, res) => {
    try {
        const { userId, targetUser, userToken, action } = req.body;
        
        if (!userId || !targetUser || !userToken || !action) {
            return res.status(400).json({
                error: '缺少必要参数'
            });
        }

        const stream = require('getstream');
        const client = stream.connect(
            process.env.GETSTREAM_API_KEY,
            userToken,
            process.env.GETSTREAM_APP_ID
        );
        
        const timelineFeed = client.feed('timeline', userId);
        
        if (action === 'follow') {
            await timelineFeed.follow('user', targetUser);
        } else if (action === 'unfollow') {
            await timelineFeed.unfollow('user', targetUser);
        }
        
        res.json({
            success: true,
            action: action
        });
    } catch (error) {
        console.error('关注操作失败:', error);
        res.status(500).json({
            error: '关注操作失败'
        });
    }
});

// 提供主页面
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        error: '服务器内部错误'
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 Stream Feed服务器运行在 http://localhost:${PORT}`);
    console.log(`📊 API配置端点: http://localhost:${PORT}/api/stream-config`);
    console.log(`🔑 环境变量状态:`);
    console.log(`   - API Key: ${process.env.GETSTREAM_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`   - API Secret: ${process.env.GETSTREAM_API_SECRET ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`   - App ID: ${process.env.GETSTREAM_APP_ID ? '✅ 已配置' : '❌ 未配置'}`);
});