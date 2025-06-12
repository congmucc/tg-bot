import { ExchangeType, ICexApi, PriceResult } from '../interfaces/exchangeApi';
import HttpClient from '../../utils/http/httpClient';
import { API_CONFIG } from '../../config/env';

/**
 * Kraken交易所API实现
 */
class KrakenApi implements ICexApi {
  public readonly http: HttpClient;
  
  /**
   * 构造函数
   */
  constructor() {
    this.http = HttpClient.create(API_CONFIG.KRAKEN_API_BASE_URL || 'https://api.kraken.com', {
      timeout: 5000, // 5秒超时
      retry: 2 // 最多重试2次
    });
  }
  
  /**
   * 获取交易所名称
   */
  public getName(): string {
    return 'kraken';
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
    // Kraken使用特殊格式，例如XXBTZUSD表示BTC/USD
    const formattedToken = this.formatCurrency(tokenSymbol);
    const formattedBase = this.formatCurrency(baseTokenSymbol);
    return `${formattedToken}${formattedBase}`;
  }
  
  /**
   * 格式化货币符号
   * @param symbol 货币符号
   * @returns 格式化后的货币符号
   */
  public formatCurrency(symbol: string): string {
    const upperSymbol = symbol.toUpperCase();
    // Kraken对某些货币使用特殊前缀
    const specialCurrencies: Record<string, string> = {
      'BTC': 'XBT',
      'DOGE': 'XDG'
    };
    
    const currencyCode = specialCurrencies[upperSymbol] || upperSymbol;
    
    // 对主要货币添加X前缀，对法币添加Z前缀
    if (['BTC', 'ETH', 'XBT', 'LTC', 'XMR', 'XRP', 'XDG'].includes(currencyCode)) {
      return `X${currencyCode}`;
    } else if (['USD', 'EUR', 'GBP', 'JPY', 'CAD'].includes(currencyCode)) {
      return `Z${currencyCode}`;
    }
    
    return currencyCode;
  }
  
  /**
   * 获取代币价格
   * @param tokenSymbol 代币符号
   * @param baseTokenSymbol 基础代币符号
   * @returns 价格结果
   */
  public async getTokenPrice(tokenSymbol: string, baseTokenSymbol: string): Promise<PriceResult> {
    try {
      console.log(`[Kraken] 尝试获取 ${tokenSymbol}/${baseTokenSymbol} 价格...`);
      
      // 格式化交易对
      const pair = this.formatTradingPair(tokenSymbol, baseTokenSymbol);
      
      // 调用Kraken API获取价格
      const response = await this.http.get('/0/public/Ticker', { pair });
      
      if (response.status === 200 && response.data && response.data.result && response.data.result[pair]) {
        // Kraken API返回的结构中c[0]是最新价格
        const price = parseFloat(response.data.result[pair].c[0]);
        console.log(`[Kraken] ${tokenSymbol}/${baseTokenSymbol} 价格: ${price}`);
        
        return {
          exchange: this.getName(),
          exchangeType: this.getType(),
          success: true,
          price: price,
          timestamp: Date.now()
        };
      } else {
        // 可能是交易对不存在
        console.log(`[Kraken] 未找到交易对 ${pair}`);
        
        // 尝试不带前缀的交易对
        const simplePair = `${tokenSymbol.toUpperCase()}${baseTokenSymbol.toUpperCase()}`;
        if (response.data && response.data.result && response.data.result[simplePair]) {
          const price = parseFloat(response.data.result[simplePair].c[0]);
          console.log(`[Kraken] ${tokenSymbol}/${baseTokenSymbol} 价格(简化交易对): ${price}`);
          
          return {
            exchange: this.getName(),
            exchangeType: this.getType(),
            success: true,
            price: price,
            timestamp: Date.now()
          };
        }
        
        return {
          exchange: this.getName(),
          exchangeType: this.getType(),
          success: false,
          error: `未找到交易对 ${pair}`
        };
      }
    } catch (error: any) {
      console.error(`[Kraken] 获取价格失败:`, error);
      
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
      const baseTokens = ['USD', 'EUR', 'BTC', 'ETH'];
      
      for (const baseToken of baseTokens) {
        const pair = this.formatTradingPair(tokenSymbol, baseToken);
        try {
          const response = await this.http.get('/0/public/Ticker', { pair });
          if (response.status === 200 && response.data && response.data.result && 
              (response.data.result[pair] || response.data.result[`${tokenSymbol.toUpperCase()}${baseToken.toUpperCase()}`])) {
            return true;
          }
        } catch (error) {
          continue; // 忽略错误，继续检查下一个基础代币
        }
      }
      
      return false;
    } catch (error) {
      console.error(`[Kraken] 检查代币支持失败:`, error);
      return false;
    }
  }
}

// 创建单例实例
const krakenApi = new KrakenApi();

export default krakenApi; 