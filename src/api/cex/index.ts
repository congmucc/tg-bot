import { PriceResult } from '../interfaces/exchangeApi';

// 导入所有CEX API
import binanceApi from './binanceApi';
import okxApi from './okxApi';
import coinbaseApi from './coinbaseApi';
import krakenApi from './krakenApi';
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

// 所有CEX API列表
const cexApis = [
  binanceApi,
  okxApi,
  coinbaseApi,
  krakenApi,
  huobiApi
];

/**
 * 从中心化交易所获取代币价格
 * @param tokenSymbol 代币符号
 * @param baseTokenSymbol 基础代币符号
 * @returns 不同交易所的价格结果
 */
export async function getPriceFromCexes(
  tokenSymbol: string,
  baseTokenSymbol: string
): Promise<CexPriceResult[]> {
  const results: CexPriceResult[] = [];
  
  // 并行获取不同CEX上的价格
  const promises = cexApis.map(api => 
    api.getTokenPrice(tokenSymbol, baseTokenSymbol)
      .then(result => {
        if (result.success && result.price !== undefined) {
          console.log(`[${api.getName()}] 获取的价格: ${result.price}`);
          results.push({
            exchange: api.getName(),
            success: true,
            price: result.price
          });
        } else {
          results.push({
            exchange: api.getName(),
            success: false,
            error: result.error || '未找到价格'
          });
        }
      })
      .catch(error => {
        console.error(`[${api.getName()}] 获取价格失败:`, error.message);
        results.push({
          exchange: api.getName(),
          success: false,
          error: error.message
          });
      })
  );
  
  // 等待所有价格查询完成
  await Promise.all(promises);
  
  return results;
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
      kraken: krakenApi,
      huobi: huobiApi
    };
  }
}

// 导出所有CEX API
export {
  binanceApi,
  okxApi,
  coinbaseApi,
  krakenApi,
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
    kraken: typeof krakenApi;
    huobi: typeof huobiApi;
  };
};
export default cexApiManager; 