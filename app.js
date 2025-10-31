// Stream Feed 应用主逻辑
class StreamFeedApp {
    constructor() {
        // 从服务器获取配置
        this.apiKey = null;
        this.appId = null;
        this.client = null;
        this.currentUser = null;
        this.userToken = null;
        this.userFeed = null;
        this.timelineFeed = null;
        this.activities = [];
        this.isFollowing = false;
        this.currentSort = 'time';
        this.serverUrl = window.location.origin; // 使用当前域名
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadServerConfig();
        this.loadSampleData();
    }

    setupEventListeners() {
        // 回车键连接用户
        document.getElementById('usernameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.connectUser();
            }
        });
    }

    // 从服务器加载Stream配置
    async loadServerConfig() {
        try {
            this.showLoading('正在加载配置...');
            
            const response = await fetch(`${this.serverUrl}/api/stream-config`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const config = await response.json();
            this.apiKey = config.apiKey;
            this.appId = config.appId;
            
            console.log('✅ Stream配置加载成功');
            
        } catch (error) {
            console.error('❌ 加载Stream配置失败:', error);
            this.showError('无法连接到服务器，请确保服务器正在运行');
            
            // 降级到硬编码配置（仅用于演示）
            this.apiKey = 'gp6e8sxxzud6';
            this.appId = '1142';
            console.log('⚠️ 使用降级配置');
        }
    }

    // 连接用户到Stream
    async connectUser() {
        const username = document.getElementById('usernameInput').value.trim();
        if (!username) {
            this.showError('请输入用户名');
            return;
        }

        if (!this.apiKey || !this.appId) {
            this.showError('Stream配置未加载，请刷新页面重试');
            return;
        }

        try {
            this.showLoading('正在连接...');
            
            // 从服务器获取用户token
            const tokenResponse = await fetch(`${this.serverUrl}/api/generate-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: username })
            });

            if (!tokenResponse.ok) {
                throw new Error('获取用户token失败');
            }

            const tokenData = await tokenResponse.json();
            this.userToken = tokenData.token;
            
            // 连接到Stream
            this.client = stream.connect(this.apiKey, this.userToken, this.appId);
            this.currentUser = username;
            
            // 获取用户的feed
            this.userFeed = this.client.feed('user', username);
            this.timelineFeed = this.client.feed('timeline', username);
            
            this.updateConnectionStatus(true);
            await this.loadActivities();
            
        } catch (error) {
            console.error('连接失败:', error);
            this.showError('连接失败，请检查网络或稍后重试');
            this.updateConnectionStatus(false);
        }
    }



    // 显示加载状态
    showLoading(message) {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.innerHTML = `
            <span class="status-indicator loading"></span>
            ${message}
        `;
    }

    // 显示错误信息
    showError(message) {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.innerHTML = `
            <span class="status-indicator error"></span>
            错误: ${message}
        `;
    }

    // 更新连接状态
    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        const userActionsElement = document.getElementById('userActions');
        
        if (connected) {
            statusElement.innerHTML = `
                <span class="status-indicator connected"></span>
                已连接用户: <strong>${this.currentUser}</strong>
            `;
            userActionsElement.style.display = 'block';
        } else {
            statusElement.innerHTML = `
                <span class="status-indicator disconnected"></span>
                未连接
            `;
            userActionsElement.style.display = 'none';
        }
    }

    // 更新关注按钮状态
    updateFollowButton() {
        const followBtn = document.getElementById('followBtn');
        if (this.isFollowing) {
            followBtn.textContent = '已关注';
            followBtn.className = 'btn btn-success';
        } else {
            followBtn.textContent = '关注';
            followBtn.className = 'btn btn-secondary';
        }
    }

    // 切换关注状态
    async toggleFollow() {
        if (!this.client || !this.currentUser) {
            this.showError('请先连接用户');
            return;
        }

        try {
            if (this.isFollowing) {
                // 取消关注
                await this.timelineFeed.unfollow('user', 'demo_user');
                this.isFollowing = false;
                this.showSuccess('已取消关注');
            } else {
                // 关注
                await this.timelineFeed.follow('user', 'demo_user');
                this.isFollowing = true;
                this.showSuccess('关注成功');
            }
            
            this.updateFollowButton();
            await this.loadActivities();
            
        } catch (error) {
            console.error('关注操作失败:', error);
            this.showError('操作失败，请稍后重试');
        }
    }

    // 加载活动列表
    async loadActivities() {
        if (!this.client) {
            this.loadSampleData();
            return;
        }

        try {
            this.showLoading('加载中...');
            
            // 获取timeline feed的活动
            const response = await this.timelineFeed.get({ limit: 20 });
            this.activities = response.results || [];
            
            // 如果没有活动，加载示例数据
            if (this.activities.length === 0) {
                this.loadSampleData();
            } else {
                this.renderActivities();
            }
            
        } catch (error) {
            console.error('加载活动失败:', error);
            this.loadSampleData(); // 降级到示例数据
        }
    }

    // 加载示例数据
    loadSampleData() {
        this.activities = [
            {
                id: '1',
                actor: 'alice',
                verb: 'post',
                object: 'photo:1',
                foreign_id: 'photo:1',
                message: '今天天气真好，在公园里拍了这张美丽的照片！ 🌸',
                image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=250&fit=crop',
                time: new Date(Date.now() - 2 * 60 * 60 * 1000),
                likes: 15,
                comments: [
                    { author: 'bob', text: '太美了！' },
                    { author: 'charlie', text: '哪个公园？我也想去' }
                ],
                liked: false
            },
            {
                id: '2',
                actor: 'bob',
                verb: 'post',
                object: 'photo:2',
                foreign_id: 'photo:2',
                message: '周末和朋友们一起爬山，山顶的风景绝美！ 🏔️',
                image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=250&fit=crop&q=80&auto=format',
                time: new Date(Date.now() - 5 * 60 * 60 * 1000),
                likes: 23,
                comments: [
                    { author: 'alice', text: '好羡慕！' },
                    { author: 'david', text: '下次带我一起' },
                    { author: 'eve', text: '运动真好' }
                ],
                liked: false
            },
            {
                id: '3',
                actor: 'charlie',
                verb: 'post',
                object: 'photo:3',
                foreign_id: 'photo:3',
                message: '新学会的咖啡拉花技巧，第一次尝试就成功了！ ☕',
                image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=250&fit=crop&q=80&auto=format',
                time: new Date(Date.now() - 8 * 60 * 60 * 1000),
                likes: 8,
                comments: [
                    { author: 'alice', text: '好厉害！' }
                ],
                liked: false
            },
            {
                id: '4',
                actor: 'david',
                verb: 'post',
                object: 'photo:4',
                foreign_id: 'photo:4',
                message: '今天的晚霞特别美，忍不住拍下来分享给大家 🌅',
                image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=250&fit=crop&q=80&auto=format&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
                time: new Date(Date.now() - 12 * 60 * 60 * 1000),
                likes: 31,
                comments: [
                    { author: 'eve', text: '太美了！' },
                    { author: 'alice', text: '大自然真神奇' }
                ],
                liked: false
            }
        ];
        
        this.renderActivities();
    }

    // 渲染活动列表
    renderActivities() {
        const container = document.getElementById('feedContainer');
        
        if (this.activities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>暂无动态</h3>
                    <p>还没有任何动态，快去关注一些用户吧！</p>
                </div>
            `;
            return;
        }

        const activitiesHtml = this.activities.map(activity => this.renderActivity(activity)).join('');
        container.innerHTML = activitiesHtml;
    }

    // 渲染单个活动
    renderActivity(activity) {
        const timeAgo = this.getTimeAgo(activity.time);
        const commentsHtml = activity.comments ? 
            activity.comments.map(comment => `
                <div class="comment-item">
                    <div class="comment-author">${comment.author}</div>
                    <div>${comment.text}</div>
                </div>
            `).join('') : '';

        return `
            <div class="activity-item" data-id="${activity.id}">
                <div class="activity-header">
                    <div class="activity-avatar">${activity.actor.charAt(0).toUpperCase()}</div>
                    <div class="activity-user">
                        <h4>${activity.actor}</h4>
                        <div class="activity-time">${timeAgo}</div>
                    </div>
                </div>
                
                ${activity.image ? `<img src="${activity.image}" alt="Activity image" class="activity-image" />` : ''}
                
                <div class="activity-description">${activity.message}</div>
                
                <div class="activity-actions">
                    <button class="action-btn ${activity.liked ? 'liked' : ''}" onclick="app.toggleLike('${activity.id}')">
                        ${activity.liked ? '❤️' : '🤍'} ${activity.likes || 0}
                    </button>
                    <button class="action-btn" onclick="app.toggleComments('${activity.id}')">
                        💬 ${activity.comments ? activity.comments.length : 0}
                    </button>
                </div>
                
                <div class="comments-section" id="comments-${activity.id}" style="display: none;">
                    <div class="comment-input">
                        <input type="text" placeholder="写评论..." id="comment-input-${activity.id}" />
                        <button onclick="app.addComment('${activity.id}')">发送</button>
                    </div>
                    <div class="comments-list">
                        ${commentsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    // 切换点赞状态
    async toggleLike(activityId) {
        const activity = this.activities.find(a => a.id === activityId);
        if (!activity) return;

        try {
            if (activity.liked) {
                activity.likes = Math.max(0, activity.likes - 1);
                activity.liked = false;
            } else {
                activity.likes = (activity.likes || 0) + 1;
                activity.liked = true;
            }

            // 如果连接了Stream，可以在这里调用API
            if (this.client && this.userFeed) {
                // await this.userFeed.addActivity({
                //     actor: this.currentUser,
                //     verb: activity.liked ? 'like' : 'unlike',
                //     object: activity.foreign_id
                // });
            }

            this.renderActivities();
            
        } catch (error) {
            console.error('点赞操作失败:', error);
            this.showError('操作失败，请稍后重试');
        }
    }

    // 切换评论区显示
    toggleComments(activityId) {
        const commentsSection = document.getElementById(`comments-${activityId}`);
        if (commentsSection.style.display === 'none') {
            commentsSection.style.display = 'block';
            document.getElementById(`comment-input-${activityId}`).focus();
        } else {
            commentsSection.style.display = 'none';
        }
    }

    // 添加评论
    async addComment(activityId) {
        const input = document.getElementById(`comment-input-${activityId}`);
        const commentText = input.value.trim();
        
        if (!commentText) return;

        const activity = this.activities.find(a => a.id === activityId);
        if (!activity) return;

        try {
            const newComment = {
                author: this.currentUser || '匿名用户',
                text: commentText
            };

            if (!activity.comments) {
                activity.comments = [];
            }
            activity.comments.push(newComment);

            // 如果连接了Stream，可以在这里调用API
            if (this.client && this.userFeed) {
                // await this.userFeed.addActivity({
                //     actor: this.currentUser,
                //     verb: 'comment',
                //     object: activity.foreign_id,
                //     message: commentText
                // });
            }

            input.value = '';
            this.renderActivities();
            
            // 重新显示评论区
            setTimeout(() => {
                this.toggleComments(activityId);
            }, 100);
            
        } catch (error) {
            console.error('评论失败:', error);
            this.showError('评论失败，请稍后重试');
        }
    }

    // 排序活动
    sortActivities() {
        const sortType = document.getElementById('sortSelect').value;
        this.currentSort = sortType;

        if (sortType === 'likes') {
            this.activities.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        } else {
            this.activities.sort((a, b) => new Date(b.time) - new Date(a.time));
        }

        this.renderActivities();
    }

    // 工具函数：获取相对时间
    getTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - new Date(date)) / 1000);

        if (diffInSeconds < 60) {
            return '刚刚';
        } else if (diffInSeconds < 3600) {
            return `${Math.floor(diffInSeconds / 60)}分钟前`;
        } else if (diffInSeconds < 86400) {
            return `${Math.floor(diffInSeconds / 3600)}小时前`;
        } else {
            return `${Math.floor(diffInSeconds / 86400)}天前`;
        }
    }

    // 显示加载状态
    showLoading(message = '加载中...') {
        document.getElementById('feedContainer').innerHTML = `
            <div class="loading">${message}</div>
        `;
    }

    // 显示错误信息
    showError(message) {
        const container = document.getElementById('feedContainer');
        container.innerHTML = `
            <div class="error">${message}</div>
            ${container.innerHTML}
        `;
        
        // 3秒后自动隐藏错误信息
        setTimeout(() => {
            const errorDiv = container.querySelector('.error');
            if (errorDiv) {
                errorDiv.remove();
            }
        }, 3000);
    }

    // 显示成功信息
    showSuccess(message) {
        const container = document.getElementById('feedContainer');
        const successDiv = document.createElement('div');
        successDiv.className = 'error'; // 复用样式，但改为绿色
        successDiv.style.background = '#d4edda';
        successDiv.style.color = '#155724';
        successDiv.style.borderColor = '#c3e6cb';
        successDiv.textContent = message;
        
        container.insertBefore(successDiv, container.firstChild);
        
        // 3秒后自动隐藏
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }
}

// 全局函数，供HTML调用
let app;

function connectUser() {
    app.connectUser();
}

function toggleFollow() {
    app.toggleFollow();
}

function sortActivities() {
    app.sortActivities();
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    app = new StreamFeedApp();
});