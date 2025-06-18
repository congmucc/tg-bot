import uniswapAPI from './uniswap';
import raydiumAPI from './raydium';
import oneInchApi from './oneinchApi';
import { resolveToken } from '../../services/tokenResolver';
import { API_CONFIG } from '../../config/env';
import { IDexApi, PriceResult, ExchangeType, BlockchainType } from '../interfaces/exchangeApi';

interface DexPriceResult {
  dex: string;
  chain: string;
  success: boolean;
  price?: string;
  error?: string;
}

/**
 * DEX类型
 */
export type DexType = 'uniswap' | 'raydium' | '1inch';

/**
 * DEX API集合 - 延长超时时间，让更多DEX有机会成功
 */
const dexApis: Record<DexType, IDexApi> = {
  uniswap: uniswapAPI, // 延长超时时间
  raydium: raydiumAPI,  // 延长超时时间
  '1inch': oneInchApi   // 延长超时时间
};

/**
 * 按类型获取对应的DEX API
 * @param dex DEX类型
 */
export function getDexApi(dex: DexType): IDexApi {
  return dexApis[dex];
}

/**
 * 检查代币是否存在
 * @param symbol 代币符号
 */
export async function isTokenSupported(symbol: string): Promise<boolean> {
  const token = await resolveToken(symbol);
  return token !== null;
}

/**
 * 获取不同DEX上的价格
 * @param tokenSymbol 代币符号
 * @param baseTokenSymbol 基础代币符号
 * @returns 不同DEX上的价格结果
 */
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
 * 获取不同DEX上的价格 - 优化并发版本
 * @param tokenSymbol 代币符号
 * @param baseTokenSymbol 基础代币符号
 * @returns 不同DEX上的价格结果
 */
export async function getPriceAcrossDexes(
  tokenSymbol: string,
  baseTokenSymbol = 'USDT'
): Promise<DexPriceResult[]> {
  // 规范化代币符号
  const normalizedTokenSymbol = tokenSymbol.toUpperCase();
  const normalizedBaseTokenSymbol = baseTokenSymbol.toUpperCase();

  console.log(`🚀 并发查询${Object.keys(dexApis).length}个DEX的${normalizedTokenSymbol}/${normalizedBaseTokenSymbol}价格...`);

  // 并发获取所有DEX价格，每个请求都有独立的超时
  const promises = Object.entries(dexApis).map(async ([dexName, dexApi]) => {
    try {
      console.log(`[${dexApi.getName()}] 开始查询...`);

      // 为每个DEX请求设置20秒超时（DEX通常比CEX慢）
      const priceResult = await withTimeout(
        dexApi.getTokenPrice(normalizedTokenSymbol, normalizedBaseTokenSymbol),
        20000
      );

      if (priceResult.success && priceResult.price !== undefined) {
        console.log(`✅ [${dexApi.getName()}] 成功: ${priceResult.price}`);
        return {
          dex: dexApi.getName(),
          chain: dexApi.getBlockchain().toLowerCase(),
          success: true,
          price: priceResult.price.toString()
        };
      } else {
        console.log(`❌ [${dexApi.getName()}] 失败: ${priceResult.error || '未找到价格'}`);
        return {
          dex: dexApi.getName(),
          chain: dexApi.getBlockchain().toLowerCase(),
          success: false,
          error: priceResult.error || '未找到价格'
        };
      }
    } catch (error: any) {
      console.log(`❌ [${dexApi.getName()}] 异常: ${error.message}`);
      return {
        dex: dexApi.getName(),
        chain: dexApi.getBlockchain().toLowerCase(),
        success: false,
        error: error.message
      };
    }
  });

  // 使用Promise.allSettled等待所有请求完成
  const results = await Promise.allSettled(promises);

  // 提取所有结果
  const dexResults: DexPriceResult[] = results.map(result => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        dex: 'unknown',
        chain: 'unknown',
        success: false,
        error: result.reason?.message || '请求失败'
      };
    }
  });

  const successCount = dexResults.filter(r => r.success).length;
  console.log(`📊 DEX查询完成: ${successCount}/${Object.keys(dexApis).length} 成功`);

  return dexResults;
}

/**
 * DEX API管理器类
 */
class DexApiManager {
  /**
   * 获取DEX API
   */
  public getDexApi = getDexApi;

/**
   * 检查代币是否支持
   */
  public isTokenSupported = isTokenSupported;
  
  /**
   * 获取不同DEX上的价格
   */
  public getPriceAcrossDexes = getPriceAcrossDexes;

/**
   * 获取所有DEX API
   */
  public get apis() {
    return {
      uniswap: uniswapAPI,
      raydium: raydiumAPI,
      '1inch': oneInchApi
    };
  }
}

// 创建并导出实例
const dexApiManager = new DexApiManager();
export default dexApiManager;

// 导出所有DEX API
export {
  uniswapAPI,
  raydiumAPI,
  oneInchApi
}; 