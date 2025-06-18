import { ExchangeType, ICexApi, PriceResult } from '../interfaces/exchangeApi';
import HttpClient from '../../utils/http/httpClient';
import { API_CONFIG } from '../../config/env';

/**
 * Binance交易所API实现
 */
class BinanceApi implements ICexApi {
  /**
   * HTTP客户端
   */
  public readonly http: HttpClient;
  
  /**
   * 构造函数
   */
  constructor() {
    this.http = HttpClient.create(API_CONFIG.BINANCE_API_BASE_URL || 'https://api.binance.com', {
      timeout: 5000, // 5秒超时
      retry: 2 // 最多重试2次
    });
  }
  
  /**
   * 获取交易所名称
   */
  public getName(): string {
    return 'binance';
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
    return `${tokenSymbol.toUpperCase()}${baseTokenSymbol.toUpperCase()}`;
  }
  
  /**
   * 获取代币价格
   * @param tokenSymbol 代币符号
   * @param baseTokenSymbol 基础代币符号
   * @returns 价格结果
   */
  public async getTokenPrice(tokenSymbol: string, baseTokenSymbol: string): Promise<PriceResult> {
    try {
      console.log(`[Binance] 尝试获取 ${tokenSymbol}/${baseTokenSymbol} 价格...`);
      
      // 对于USDC基础代币，优先尝试USDT交易对，然后再进行价格转换
      if (baseTokenSymbol.toUpperCase() === 'USDC') {
        try {
          console.log(`[Binance] USDC交易对可能不存在，尝试使用USDT交易对...`);
          const usdtSymbol = this.formatTradingPair(tokenSymbol, 'USDT');
          const usdtResponse = await this.http.get('/api/v3/ticker/price', { params: { symbol: usdtSymbol } });

          if (usdtResponse.status === 200 && usdtResponse.data && usdtResponse.data.price) {
            const price = parseFloat(usdtResponse.data.price);
            // USDT和USDC通常接近1:1，直接返回
            console.log(`[Binance] 使用USDT价格作为USDC价格: ${price}`);
            return {
              exchange: this.getName(),
              exchangeType: this.getType(),
              success: true,
              price: price,
              timestamp: Date.now()
            };
          }
        } catch (error) {
          console.log(`[Binance] USDT替代方案失败，继续尝试原始USDC交易对`);
        }
      }
      
      // 格式化交易对
      const symbol = this.formatTradingPair(tokenSymbol, baseTokenSymbol);
      
      // 调用Binance API获取价格
      const response = await this.http.get('/api/v3/ticker/price', { params: { symbol: symbol } });
      
      if (response.status === 200 && response.data && response.data.price) {
        const price = parseFloat(response.data.price);
        console.log(`[Binance] ${tokenSymbol}/${baseTokenSymbol} 价格: ${price}`);
        
        return {
          exchange: this.getName(),
          exchangeType: this.getType(),
          success: true,
          price: price,
          timestamp: Date.now()
        };
      } else {
        // 可能是交易对不存在
        console.log(`[Binance] 未找到交易对 ${symbol}`);
        
        // 尝试反转交易对
        if (baseTokenSymbol.toUpperCase() === 'USD') {
          // 对于USD，尝试使用USDT
          return this.getTokenPrice(tokenSymbol, 'USDT');
        }
        
        return {
          exchange: this.getName(),
          exchangeType: this.getType(),
          success: false,
          error: `未找到交易对 ${symbol}`
        };
      }
    } catch (error: any) {
      console.error(`[Binance] 获取价格失败:`, error);
      
      // 尝试特殊处理某些错误
      if (error.response && error.response.status === 400) {
        // 可能是交易对不存在
        console.log(`[Binance] 交易对不存在，尝试替代方案...`);
        
        // 如果是USD/USDC，尝试使用USDT
        if (baseTokenSymbol.toUpperCase() === 'USD' || baseTokenSymbol.toUpperCase() === 'USDC') {
          try {
            return await this.getTokenPrice(tokenSymbol, 'USDT');
          } catch (innerError) {
            console.error(`[Binance] 替代方案也失败:`, innerError);
          }
        }
      }
      
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
      const baseTokens = ['USDT', 'USDC', 'BTC', 'ETH'];
      
      for (const baseToken of baseTokens) {
        const symbol = this.formatTradingPair(tokenSymbol, baseToken);
        try {
          const response = await this.http.get('/api/v3/ticker/price', { params: { symbol: symbol } });
          if (response.status === 200 && response.data && response.data.price) {
            return true;
          }
        } catch (error) {
          continue; // 忽略错误，继续检查下一个基础代币
        }
      }
      
      return false;
    } catch (error) {
      console.error(`[Binance] 检查代币支持失败:`, error);
      return false;
    }
  }
  
  /**
   * 获取24小时价格变化
   * @param tokenSymbol 代币符号
   * @param baseTokenSymbol 基础代币符号
   * @returns 价格变化数据
   */
  public async get24hPriceChange(tokenSymbol: string, baseTokenSymbol: string): Promise<any> {
    try {
      const symbol = this.formatTradingPair(tokenSymbol, baseTokenSymbol);
      const response = await this.http.get('/api/v3/ticker/price', { params: { symbol: symbol } });
      
      if (response.status === 200 && response.data) {
        return {
          symbol: response.data.symbol,
          priceChange: parseFloat(response.data.priceChange),
          priceChangePercent: parseFloat(response.data.priceChangePercent),
          lastPrice: parseFloat(response.data.lastPrice),
          volume: parseFloat(response.data.volume),
          highPrice: parseFloat(response.data.highPrice),
          lowPrice: parseFloat(response.data.lowPrice)
        };
      }
      
      return null;
    } catch (error) {
      console.error(`[Binance] 获取24小时价格变化失败:`, error);
      return null;
    }
  }
}

// 创建单例实例
const binanceApi = new BinanceApi();

export default binanceApi; 