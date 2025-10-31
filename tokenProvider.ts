import jwt from 'jsonwebtoken';

export interface TokenGenerationOptions {
  userId: string;
  validityInSeconds?: number;
}

export interface TokenInfo {
  token: string;
  expiresAt: Date;
  userId: string;
}

export class StreamTokenProvider {
  private apiKey: string;
  private apiSecret: string;

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  /**
   * 生成用户令牌
   * @param options 令牌生成选项
   * @returns 包含令牌信息的对象
   */
  generateUserToken(options: TokenGenerationOptions): TokenInfo {
    const { userId, validityInSeconds = 3600 } = options; // 默认1小时有效期
    
    console.log(`🔑 正在为用户 ${userId} 生成令牌，有效期: ${validityInSeconds}秒`);
    
    // 手动生成 JWT 令牌，因为客户端版本的 FeedsClient 不支持服务器端令牌生成
    const payload = {
      user_id: userId,
      iat: Math.floor(Date.now() / 1000), // 签发时间
      exp: Math.floor(Date.now() / 1000) + validityInSeconds // 过期时间
    };
    
    const token = jwt.sign(payload, this.apiSecret, { algorithm: 'HS256' });
    const expiresAt = new Date(Date.now() + validityInSeconds * 1000);
    
    return {
      token,
      expiresAt,
      userId
    };
  }

  /**
   * 验证令牌是否有效
   * @param token JWT令牌
   * @returns 是否有效
   */
  validateToken(token: string): boolean {
    try {
      const decoded = jwt.verify(token, this.apiSecret) as any;
      
      // 检查令牌是否过期
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        console.log('⚠️ 令牌已过期');
        return false;
      }
      
      console.log('✅ 令牌验证成功');
      return true;
    } catch (error) {
      console.log('❌ 令牌验证失败:', error);
      return false;
    }
  }

  /**
   * 从令牌中提取用户信息
   * @param token JWT令牌
   * @returns 用户信息
   */
  getUserFromToken(token: string): { userId: string; exp?: number } | null {
    try {
      const decoded = jwt.verify(token, this.apiSecret) as any;
      return {
        userId: decoded.user_id,
        exp: decoded.exp
      };
    } catch (error) {
      console.log('❌ 无法从令牌中提取用户信息:', error);
      return null;
    }
  }

  /**
   * 检查令牌是否即将过期（在指定分钟内）
   * @param token JWT令牌
   * @param minutesBeforeExpiry 过期前多少分钟算作即将过期
   * @returns 是否即将过期
   */
  isTokenExpiringSoon(token: string, minutesBeforeExpiry: number = 5): boolean {
    try {
      const decoded = jwt.verify(token, this.apiSecret) as any;
      
      if (!decoded.exp) {
        return false;
      }
      
      const expiryTime = decoded.exp * 1000; // 转换为毫秒
      const warningTime = expiryTime - (minutesBeforeExpiry * 60 * 1000);
      
      return Date.now() >= warningTime;
    } catch (error) {
      return true; // 如果无法解析，认为需要刷新
    }
  }
}

/**
 * 令牌管理器类，用于自动处理令牌刷新
 */
export class TokenManager {
  private tokenProvider: StreamTokenProvider;
  private currentToken: TokenInfo | null = null;
  private refreshCallback?: (newToken: string) => void;

  constructor(tokenProvider: StreamTokenProvider) {
    this.tokenProvider = tokenProvider;
  }

  /**
   * 设置令牌刷新回调
   * @param callback 当令牌刷新时调用的回调函数
   */
  setRefreshCallback(callback: (newToken: string) => void) {
    this.refreshCallback = callback;
  }

  /**
   * 获取有效的令牌，如果需要会自动刷新
   * @param userId 用户ID
   * @param validityInSeconds 令牌有效期（秒）
   * @returns 有效的令牌
   */
  async getValidToken(userId: string, validityInSeconds?: number): Promise<string> {
    // 如果没有当前令牌或令牌即将过期，生成新令牌
    if (!this.currentToken || 
        this.currentToken.userId !== userId ||
        this.tokenProvider.isTokenExpiringSoon(this.currentToken.token)) {
      
      console.log('🔄 正在刷新令牌...');
      this.currentToken = this.tokenProvider.generateUserToken({ 
        userId, 
        validityInSeconds 
      });
      
      // 调用刷新回调
      if (this.refreshCallback) {
        this.refreshCallback(this.currentToken.token);
      }
    }
    
    return this.currentToken.token;
  }

  /**
   * 清除当前令牌
   */
  clearToken() {
    this.currentToken = null;
    console.log('🗑️ 令牌已清除');
  }
}