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
 * DEX API集合
 */
const dexApis: Record<DexType, IDexApi> = {
  uniswap: uniswapAPI,
  raydium: raydiumAPI,
  '1inch': oneInchApi
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
export async function getPriceAcrossDexes(
  tokenSymbol: string,
  baseTokenSymbol = 'USDT'
): Promise<DexPriceResult[]> {
  const results: DexPriceResult[] = [];
  
  // 规范化代币符号
  const normalizedTokenSymbol = tokenSymbol.toUpperCase();
  const normalizedBaseTokenSymbol = baseTokenSymbol.toUpperCase();
  
  // 并行获取不同DEX上的价格
  const promises = [];
  
  // 遍历所有DEX API并获取价格
  for (const [dexName, dexApi] of Object.entries(dexApis)) {
    promises.push(
      (async () => {
        try {
          console.log(`尝试从${dexApi.getName()}获取 ${normalizedTokenSymbol}/${normalizedBaseTokenSymbol} 价格...`);
          const priceResult = await dexApi.getTokenPrice(normalizedTokenSymbol, normalizedBaseTokenSymbol);
          
          if (priceResult.success && priceResult.price !== undefined) {
            console.log(`[${dexApi.getName()}] 获取的价格: ${priceResult.price}`);
            results.push({
              dex: dexApi.getName(),
              chain: dexApi.getBlockchain().toLowerCase(),
              success: true,
              price: priceResult.price.toString()
            });
          } else {
            results.push({
              dex: dexApi.getName(),
              chain: dexApi.getBlockchain().toLowerCase(),
              success: false,
              error: priceResult.error || '未找到价格'
            });
          }
        } catch (error) {
          const err = error as Error;
          console.error(`[${dexApi.getName()}] 获取价格失败:`, err.message);
          results.push({
            dex: dexApi.getName(),
            chain: dexApi.getBlockchain().toLowerCase(),
            success: false,
            error: err.message
          });
        }
      })()
    );
  }
  
  // 等待所有价格查询完成
  await Promise.all(promises);
  
  return results;
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