import { ExchangeType, ICexApi, PriceResult } from '../interfaces/exchangeApi';
import HttpClient from '../../utils/http/httpClient';
import { API_CONFIG } from '../../config/env';

/**
 * Coinbase交易所API实现
 */
class CoinbaseApi implements ICexApi {
  public readonly http: HttpClient;
  
  /**
   * 构造函数
   */
  constructor() {
    this.http = HttpClient.create(API_CONFIG.COINBASE_API_BASE_URL || 'https://api.coinbase.com', {
      timeout: 5000, // 5秒超时
      retry: 2 // 最多重试2次
    });
  }
  
  /**
   * 获取交易所名称
   */
  public getName(): string {
    return 'coinbase';
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
    return `${tokenSymbol.toUpperCase()}-${baseTokenSymbol.toUpperCase()}`;
  }
  
  /**
   * 获取代币价格
   * @param tokenSymbol 代币符号
   * @param baseTokenSymbol 基础代币符号
   * @returns 价格结果
   */
  public async getTokenPrice(tokenSymbol: string, baseTokenSymbol: string): Promise<PriceResult> {
    try {
      console.log(`[Coinbase] 尝试获取 ${tokenSymbol}/${baseTokenSymbol} 价格...`);
      
      // 格式化交易对
      const pairSymbol = this.formatTradingPair(tokenSymbol, baseTokenSymbol);
      
      // 调用Coinbase API获取价格
      const response = await this.http.get(`/v2/prices/${pairSymbol}/spot`);
      
      if (response.status === 200 && response.data && response.data.data && response.data.data.amount) {
        const price = parseFloat(response.data.data.amount);
        console.log(`[Coinbase] ${tokenSymbol}/${baseTokenSymbol} 价格: ${price}`);
        
        return {
          exchange: this.getName(),
          exchangeType: this.getType(),
          success: true,
          price: price,
          timestamp: Date.now()
        };
      } else {
        // 可能是交易对不存在
        console.log(`[Coinbase] 未找到交易对 ${pairSymbol}`);
        
        return {
          exchange: this.getName(),
          exchangeType: this.getType(),
          success: false,
          error: `未找到交易对 ${pairSymbol}`
        };
      }
    } catch (error: any) {
      console.error(`[Coinbase] 获取价格失败:`, error);
      
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
      const baseTokens = ['USD', 'USDT', 'BTC', 'ETH'];
      
      for (const baseToken of baseTokens) {
        const pairSymbol = this.formatTradingPair(tokenSymbol, baseToken);
        try {
          const response = await this.http.get(`/v2/prices/${pairSymbol}/spot`);
          if (response.status === 200 && response.data && response.data.data && response.data.data.amount) {
            return true;
          }
        } catch (error) {
          continue; // 忽略错误，继续检查下一个基础代币
        }
      }
      
      return false;
    } catch (error) {
      console.error(`[Coinbase] 检查代币支持失败:`, error);
      return false;
    }
  }
}

// 创建单例实例
const coinbaseApi = new CoinbaseApi();

export default coinbaseApi; 