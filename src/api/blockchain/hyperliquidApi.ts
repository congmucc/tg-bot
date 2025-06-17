import axios from 'axios';
import { API_CONFIG } from '../../config/env';

class HyperliquidAPI {
  public readonly baseUrl: string;
  public readonly backupBaseUrl: string;
  public readonly directApiUrl: string;
  public readonly explorerApiUrl: string; // 添加Explorer API端点
  public readonly websiteApiUrl: string;  // 添加网站API端点
  public readonly alternativeApiUrl: string; // 添加另一个备用API
  public readonly wsUrl: string;
  public readonly minValue: number;

  constructor(minValue: number = 100000) {
    // 使用环境变量或默认值
    this.baseUrl = process.env.HYPERLIQUID_API_URL || API_CONFIG.HYPERLIQUID_API_URL || 'https://api.hyperliquid.xyz';
    this.backupBaseUrl = process.env.HYPERLIQUID_BACKUP_API_URL || 'https://hyperliquid-api-proxy.onrender.com';
    this.directApiUrl = 'https://data.hyperliquid.xyz/api/info/recentTrades';
    this.explorerApiUrl = 'https://api-explorer.hyperliquid.xyz/api';
    this.websiteApiUrl = 'https://hyperliquid.com/api';
    this.alternativeApiUrl = 'https://api.hlapi.io/v1';
    this.wsUrl = 'wss://api.hyperliquid.xyz/ws';
    this.minValue = minValue;
  }

  /**
   * 获取大额交易
   * @param minValue 最小交易额（USD）
   * @param limit 返回数量限制
   */
  async getLargeTransactions(minValue: number = 100000, limit: number = 10): Promise<any> {
    try {
      console.log(`获取Hyperliquid大额交易，最小值: $${minValue}`);

      // 使用主要的Hyperliquid API端点
      const response = await axios.get(`${this.baseUrl}/info/recentTrades`, {
        timeout: 15000
      });

      if (response.data && Array.isArray(response.data)) {
        const trades = response.data.slice(0, Math.max(50, limit * 3)).map((trade: any) => ({
          txHash: trade.hash || trade.txHash || `hl-tx-${Date.now()}-${Math.random()}`,
          size: trade.sz || trade.size || '0',
          price: trade.px ? trade.px.toString() : '0',
          maker: trade.maker || 'Unknown',
          taker: trade.taker || 'Unknown',
          symbol: trade.coin || 'UNKNOWN',
          timestamp: Math.floor(Date.now() / 1000),
          side: trade.side || 'unknown'
        }));

        return this.processTransactions(trades, minValue, limit);
      }

      return [];
    } catch (error) {
      const err = error as Error;
      console.error(`获取Hyperliquid大额交易失败: ${err.message}`);
      return []; // 返回空数组而不是抛出错误
    }
  }

  /**
   * 处理交易数据
   */
  public processTransactions(trades: any[], minValue: number, limit: number): any[] {
    try {
      // 过滤大额交易
      const largeTransactions = trades
        .filter((trade: any) => {
          try {
            const size = parseFloat(trade.size || '0');
            const price = parseFloat(trade.price || '0');
            const value = size * price;
            return !isNaN(value) && value >= minValue;
          } catch (error) {
            return false;
          }
        })
        .slice(0, limit)
        .map((trade: any) => ({
          hash: trade.txHash || trade.tx_hash || `tx-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          from: trade.maker || trade.maker_address || 'Unknown',
          to: trade.taker || trade.taker_address || 'Unknown',
          value: (parseFloat(trade.size || '0') * parseFloat(trade.price || '0')).toFixed(2),
          size: trade.size || '0',
          price: trade.price || '0',
          timestamp: trade.timestamp || Math.floor(Date.now() / 1000),
          symbol: trade.symbol || trade.asset || trade.coin || trade.market || 'UNKNOWN',
          side: trade.side || 'unknown'
        }));

      return largeTransactions;
    } catch (error) {
      console.error(`处理Hyperliquid交易数据失败: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 获取市场信息
   */
  async getMarketInfo(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/info/meta`, { timeout: 10000 });
      if (response.data && response.data.meta) {
        return response.data.meta;
      }
      return { meta: [] };
    } catch (error) {
      const err = error as Error;
      console.error(`获取Hyperliquid市场信息失败: ${err.message}`);
      return { meta: [] };
    }
  }
}

export default new HyperliquidAPI(); 