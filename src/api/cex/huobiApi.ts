import { ExchangeType, ICexApi, PriceResult } from '../interfaces/exchangeApi';
import HttpClient from '../../utils/http/httpClient';
import { API_CONFIG } from '../../config/env';

/**
 * Huobi交易所API实现
 */
class HuobiApi implements ICexApi {
  public readonly http: HttpClient;
  
  /**
   * 构造函数
   */
  constructor() {
    this.http = HttpClient.create(API_CONFIG.HUOBI_API_BASE_URL || 'https://api.huobi.pro', {
      timeout: 5000, // 5秒超时
      retry: 2 // 最多重试2次
    });
  }
  
  /**
   * 获取交易所名称
   */
  public getName(): string {
    return 'huobi';
  }
  
  /**
   * 获取交易所类型
   */
  public getType(): ExchangeType {
    return ExchangeType.CEX;
  }
  
  /**
   * 格式化交易对符号
   * @param tokenSymbol 代币符号
   * @param baseTokenSymbol 基础代币符号
   * @returns 格式化后的交易对符号
   */
  public formatTradingPair(tokenSymbol: string, baseTokenSymbol: string): string {
    return `${tokenSymbol.toLowerCase()}${baseTokenSymbol.toLowerCase()}`;
  }
  
  /**
   * 获取代币价格
   * @param tokenSymbol 代币符号
   * @param baseTokenSymbol 基础代币符号
   * @returns 价格结果
   */
  public async getTokenPrice(tokenSymbol: string, baseTokenSymbol: string): Promise<PriceResult> {
    try {
      console.log(`[Huobi] 尝试获取 ${tokenSymbol}/${baseTokenSymbol} 价格...`);
      
      // 对于USDC基础代币，优先尝试USDT交易对，然后再进行价格转换
      if (baseTokenSymbol.toUpperCase() === 'USDC') {
        try {
          console.log(`[Huobi] USDC交易对可能不存在，尝试使用USDT交易对...`);
          const usdtResult = await this.getTokenPriceWithSymbol(tokenSymbol, 'USDT');
          
          if (usdtResult.success && usdtResult.price !== undefined) {
            // USDT和USDC通常接近1:1，直接返回
            console.log(`[Huobi] 使用USDT价格作为USDC价格: ${usdtResult.price}`);
            return {
              exchange: this.getName(),
              exchangeType: this.getType(),
              success: true,
              price: usdtResult.price,
              timestamp: Date.now()
            };
          }
        } catch (error) {
          console.log(`[Huobi] USDT替代方案失败，继续尝试原始USDC交易对`);
        }
      }
      
      return this.getTokenPriceWithSymbol(tokenSymbol, baseTokenSymbol);
    } catch (error: any) {
      console.error(`[Huobi] 获取价格失败:`, error);
      
      return {
        exchange: this.getName(),
        exchangeType: this.getType(),
        success: false,
        error: error.message || '未知错误'
      };
    }
  }
  
  /**
   * 使用指定交易对获取价格
   * @param tokenSymbol 代币符号
   * @param baseTokenSymbol 基础代币符号
   * @returns 价格结果
   */
  private async getTokenPriceWithSymbol(tokenSymbol: string, baseTokenSymbol: string): Promise<PriceResult> {
    try {
      // 格式化交易对
      const symbol = this.formatTradingPair(tokenSymbol, baseTokenSymbol);
      
      // 调用Huobi API获取价格
      const response = await this.http.get('/market/detail/merged', { symbol });
      
      if (response.status === 200 && response.data && response.data.status === 'ok' && response.data.tick) {
        // Huobi API返回的结构中close是最新价格
        const price = response.data.tick.close;
        console.log(`[Huobi] ${tokenSymbol}/${baseTokenSymbol} 价格: ${price}`);
        
        return {
          exchange: this.getName(),
          exchangeType: this.getType(),
          success: true,
          price: price,
          timestamp: Date.now()
        };
      } else {
        // 可能是交易对不存在
        console.log(`[Huobi] 未找到交易对 ${symbol}`);
        
        return {
          exchange: this.getName(),
          exchangeType: this.getType(),
          success: false,
          error: `未找到交易对 ${symbol}`
        };
      }
    } catch (error: any) {
      console.error(`[Huobi] 获取价格失败:`, error);
      
      return {
        exchange: this.getName(),
        exchangeType: this.getType(),
        success: false,
        error: error.message || '未知错误'
      };
    }
  }
  
  /**
   * 检查代币是否支持
   * @param tokenSymbol 代币符号
   * @returns 是否支持
   */
  public async isTokenSupported(tokenSymbol: string): Promise<boolean> {
    try {
      // 通过查询常见基础代币的交易对来检查
      const baseTokens = ['usdt', 'usdc', 'btc', 'eth'];
      
      for (const baseToken of baseTokens) {
        const symbol = this.formatTradingPair(tokenSymbol, baseToken);
        try {
          const response = await this.http.get('/market/detail/merged', { symbol });
          if (response.status === 200 && response.data && response.data.status === 'ok') {
            return true;
          }
        } catch (error) {
          continue; // 忽略错误，继续检查下一个基础代币
        }
      }
      
      return false;
    } catch (error) {
      console.error(`[Huobi] 检查代币支持失败:`, error);
      return false;
    }
  }
}

// 创建单例实例
const huobiApi = new HuobiApi();

export default huobiApi; 