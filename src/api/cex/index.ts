import { PriceResult } from '../interfaces/exchangeApi';

// 导入所有CEX API
import binanceApi from './binanceApi';
import okxApi from './okxApi';
import coinbaseApi from './coinbaseApi';
import huobiApi from './huobiApi';

/**
 * CEX价格结果接口
 */
export interface CexPriceResult {
  exchange: string;
  success: boolean;
  price?: number;
  error?: string;
}

// 所有CEX API - 延长超时时间，让更多API有机会成功
const cexApis = [
  okxApi,
  coinbaseApi,
  binanceApi, // 虽然有地区限制，但让它尝试
  huobiApi    // 延长超时时间，让它有机会成功
];

/**
 * 创建带超时的Promise
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`请求超时 (${timeoutMs}ms)`)), timeoutMs)
    )
  ]);
}

/**
 * 从中心化交易所获取代币价格 - 优化并发版本
 * @param tokenSymbol 代币符号
 * @param baseTokenSymbol 基础代币符号
 * @returns 不同交易所的价格结果
 */
export async function getPriceFromCexes(
  tokenSymbol: string,
  baseTokenSymbol: string
): Promise<CexPriceResult[]> {
  console.log(`🚀 并发查询${cexApis.length}个CEX的${tokenSymbol}/${baseTokenSymbol}价格...`);

  // 并发获取所有CEX价格，每个请求都有独立的超时
  const promises = cexApis.map(async (api) => {
    const exchangeName = api.getName();
    try {
      console.log(`[${exchangeName}] 开始查询...`);

      // 为每个API请求设置15秒超时，给更多时间让API成功
      const result = await withTimeout(
        api.getTokenPrice(tokenSymbol, baseTokenSymbol),
        15000
      );

      if (result.success && result.price !== undefined) {
        console.log(`✅ [${exchangeName}] 成功: $${result.price}`);
        return {
          exchange: exchangeName,
          success: true,
          price: result.price
        };
      } else {
        console.log(`❌ [${exchangeName}] 失败: ${result.error || '未找到价格'}`);
        return {
          exchange: exchangeName,
          success: false,
          error: result.error || '未找到价格'
        };
      }
    } catch (error: any) {
      console.log(`❌ [${exchangeName}] 异常: ${error.message}`);
      return {
        exchange: exchangeName,
        success: false,
        error: error.message
      };
    }
  });

  // 使用Promise.allSettled等待所有请求完成，不会因为单个失败而中断
  const results = await Promise.allSettled(promises);

  // 提取所有结果
  const cexResults: CexPriceResult[] = results.map(result => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        exchange: 'unknown',
        success: false,
        error: result.reason?.message || '请求失败'
      };
    }
  });

  const successCount = cexResults.filter(r => r.success).length;
  console.log(`📊 CEX查询完成: ${successCount}/${cexApis.length} 成功`);

  return cexResults;
}

/**
 * 获取最佳CEX价格
 * @param results CEX价格结果数组
 * @returns 最佳价格信息
 */
export function getBestCexPrice(results: CexPriceResult[]): { 
  price: number | null; 
  exchange: string | null;
  averagePrice: number | null;
} {
  // 过滤出成功的结果
  const successfulResults = results.filter(r => r.success && r.price !== undefined);
  
  if (successfulResults.length === 0) {
    return {
      price: null,
      exchange: null,
      averagePrice: null
    };
  }
  
  // 找出最低价格
  const lowestPrice = successfulResults.reduce((min, current) => {
    return (current.price as number) < (min.price as number) ? current : min;
  }, successfulResults[0]);
  
  // 计算平均价格
  const sum = successfulResults.reduce((total, current) => total + (current.price as number), 0);
  const averagePrice = sum / successfulResults.length;
  
  return {
    price: lowestPrice.price as number,
    exchange: lowestPrice.exchange,
    averagePrice: averagePrice
  };
}

/**
 * CEX API管理器类
 */
class CexApiManager {
  /**
   * 从中心化交易所获取代币价格
   */
  public getPriceFromCexes = getPriceFromCexes;
  
  /**
   * 获取最佳CEX价格
   */
  public getBestCexPrice = getBestCexPrice;
  
  /**
   * 获取所有CEX API
   */
  public get apis() {
    return {
      binance: binanceApi,
      okx: okxApi,
      coinbase: coinbaseApi,
      huobi: huobiApi
    };
  }
}

// 导出所有CEX API
export {
  binanceApi,
  okxApi,
  coinbaseApi,
  huobiApi
};

// 创建并导出实例
const cexApiManager = new CexApiManager() as {
  getPriceFromCexes: typeof getPriceFromCexes;
  getBestCexPrice: typeof getBestCexPrice;
  apis: {
    binance: typeof binanceApi;
    okx: typeof okxApi;
    coinbase: typeof coinbaseApi;
    huobi: typeof huobiApi;
  };
};
export default cexApiManager; 