import uniswapAPI from './uniswap';
import raydiumAPI from './raydium';
import { resolveToken } from '../../services/tokenResolver';
import { getCexTokenPrice } from '../../services/price';
import axios from 'axios';

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
export type DexType = 'uniswap' | 'raydium';

/**
 * DEX API集合
 */
const dexApi = {
  uniswap: uniswapAPI,
  raydium: raydiumAPI,
};

/**
 * 按类型获取对应的DEX API
 * @param dex DEX类型
 */
export function getDexApi(dex: DexType) {
  return dexApi[dex];
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
  
  // 以太坊链上的DEX
  promises.push(
    (async () => {
      try {
        console.log(`尝试从Uniswap获取 ${normalizedTokenSymbol}/${normalizedBaseTokenSymbol} 价格...`);
        const price = await uniswapAPI.getTokenPrice(normalizedTokenSymbol, normalizedBaseTokenSymbol);
        if (price) {
          console.log(`[Uniswap] 获取的价格: ${price}`);
          results.push({
            dex: 'uniswap',
            chain: 'ethereum',
            success: true,
            price: price.toString()
          });
        } else {
          results.push({
            dex: 'uniswap',
            chain: 'ethereum',
            success: false,
            error: '未找到价格'
          });
        }
      } catch (error) {
        const err = error as Error;
        console.error(`[Uniswap] 获取价格失败:`, err.message);
        results.push({
          dex: 'uniswap',
          chain: 'ethereum',
          success: false,
          error: err.message
        });
      }
    })()
  );
  
  // Solana链上的DEX
  promises.push(
    (async () => {
      try {
        console.log(`尝试从Raydium获取 ${normalizedTokenSymbol}/${normalizedBaseTokenSymbol} 价格...`);
        const price = await raydiumAPI.getTokenPrice(normalizedTokenSymbol, normalizedBaseTokenSymbol);
        if (price) {
          console.log(`[Raydium] 获取的价格: ${price}`);
          results.push({
            dex: 'raydium',
            chain: 'solana',
            success: true,
            price: price.toString()
          });
        } else {
          results.push({
            dex: 'raydium',
            chain: 'solana',
            success: false,
            error: '未找到价格'
          });
        }
      } catch (error) {
        const err = error as Error;
        console.error(`[Raydium] 获取价格失败:`, err.message);
        results.push({
          dex: 'raydium',
          chain: 'solana',
          success: false,
          error: err.message
        });
      }
    })()
  );
  
  // BSC链上的DEX
  promises.push(
    (async () => {
      try {
        console.log(`尝试从PancakeSwap获取 ${normalizedTokenSymbol}/${normalizedBaseTokenSymbol} 价格...`);
        const price = await getPancakeSwapPrice(normalizedTokenSymbol, normalizedBaseTokenSymbol);
        if (price) {
          console.log(`[PancakeSwap] 获取的价格: ${price}`);
          results.push({
            dex: 'pancakeswap',
            chain: 'bsc',
            success: true,
            price: price.toString()
          });
        } else {
          results.push({
            dex: 'pancakeswap',
            chain: 'bsc',
            success: false,
            error: '未找到价格'
          });
        }
      } catch (error) {
        const err = error as Error;
        console.error(`[PancakeSwap] 获取价格失败:`, err.message);
        results.push({
          dex: 'pancakeswap',
          chain: 'bsc',
          success: false,
          error: err.message
        });
      }
    })()
  );
  
  // dYdX
  promises.push(
    (async () => {
      try {
        console.log(`尝试从dYdX获取 ${normalizedTokenSymbol}/${normalizedBaseTokenSymbol} 价格...`);
        const price = await getDydxPrice(normalizedTokenSymbol, normalizedBaseTokenSymbol);
        if (price) {
          console.log(`[dYdX] 获取的价格: ${price}`);
          results.push({
            dex: 'dydx',
            chain: 'ethereum',
            success: true,
            price: price.toString()
          });
        } else {
          results.push({
            dex: 'dydx',
            chain: 'ethereum',
            success: false,
            error: '未找到价格'
          });
        }
      } catch (error) {
        const err = error as Error;
        console.error(`[dYdX] 获取价格失败:`, err.message);
        results.push({
          dex: 'dydx',
          chain: 'ethereum',
          success: false,
          error: err.message
        });
      }
    })()
  );
  
  // 中心化交易所
  promises.push(
    (async () => {
      try {
        const cexResults = await getCexPrices(normalizedTokenSymbol, normalizedBaseTokenSymbol);
        results.push(...cexResults);
      } catch (error) {
        const err = error as Error;
        console.error(`获取CEX价格失败:`, err.message);
      }
    })()
  );
  
  // 等待所有价格查询完成
  await Promise.all(promises);
  
  // 如果所有DEX都失败了，尝试使用CoinGecko作为最后的备选方案
  if (!results.some(r => r.success)) {
    try {
      console.log(`尝试从CoinGecko获取 ${normalizedTokenSymbol} 价格作为备选...`);
      const price = await getCoinGeckoPrice(normalizedTokenSymbol, normalizedBaseTokenSymbol);
      if (price) {
        console.log(`[CoinGecko] 获取的价格: ${price}`);
        results.push({
          dex: 'coingecko',
          chain: 'aggregator',
          success: true,
          price: price.toString()
        });
      }
    } catch (error) {
      const err = error as Error;
      console.error(`[CoinGecko] 获取价格失败:`, err.message);
    }
  }
  
  return results;
}

/**
 * 从中心化交易所获取价格
 */
async function getCexPrices(tokenSymbol: string, baseTokenSymbol: string): Promise<DexPriceResult[]> {
  const results: DexPriceResult[] = [];
  
  // 并行获取不同CEX上的价格
  const promises = [];
  
  // 币安
  promises.push(
    (async () => {
      try {
        console.log(`尝试从Binance获取 ${tokenSymbol}/${baseTokenSymbol} 价格...`);
        const price = await getBinancePrice(tokenSymbol, baseTokenSymbol);
        if (price) {
          console.log(`[Binance] 获取的价格: ${price}`);
          results.push({
            dex: 'binance',
            chain: 'centralized',
            success: true,
            price: price.toString()
          });
        } else {
          results.push({
            dex: 'binance',
            chain: 'centralized',
            success: false,
            error: '未找到价格'
          });
        }
      } catch (error) {
        const err = error as Error;
        console.error(`[Binance] 获取价格失败:`, err.message);
        results.push({
          dex: 'binance',
          chain: 'centralized',
          success: false,
          error: err.message
        });
      }
    })()
  );
  
  // OKX
  promises.push(
    (async () => {
      try {
        console.log(`尝试从OKX获取 ${tokenSymbol}/${baseTokenSymbol} 价格...`);
        const price = await getOkxPrice(tokenSymbol, baseTokenSymbol);
        if (price) {
          console.log(`[OKX] 获取的价格: ${price}`);
          results.push({
            dex: 'okx',
            chain: 'centralized',
            success: true,
            price: price.toString()
          });
        } else {
          results.push({
            dex: 'okx',
            chain: 'centralized',
            success: false,
            error: '未找到价格'
          });
        }
      } catch (error) {
        const err = error as Error;
        console.error(`[OKX] 获取价格失败:`, err.message);
        results.push({
          dex: 'okx',
          chain: 'centralized',
          success: false,
          error: err.message
        });
      }
    })()
  );
  
  // Coinbase
  promises.push(
    (async () => {
      try {
        console.log(`尝试从Coinbase获取 ${tokenSymbol}/${baseTokenSymbol} 价格...`);
        const price = await getCoinbasePrice(tokenSymbol, baseTokenSymbol);
        if (price) {
          console.log(`[Coinbase] 获取的价格: ${price}`);
          results.push({
            dex: 'coinbase',
            chain: 'centralized',
            success: true,
            price: price.toString()
          });
        } else {
          results.push({
            dex: 'coinbase',
            chain: 'centralized',
            success: false,
            error: '未找到价格'
          });
        }
      } catch (error) {
        const err = error as Error;
        console.error(`[Coinbase] 获取价格失败:`, err.message);
        results.push({
          dex: 'coinbase',
          chain: 'centralized',
          success: false,
          error: err.message
        });
      }
    })()
  );
  
  // 等待所有价格查询完成
  await Promise.all(promises);
  
  return results;
}


/**
 * 从Binance获取价格
 */
async function getBinancePrice(tokenSymbol: string, baseTokenSymbol: string): Promise<number | null> {
  try {
    const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${tokenSymbol}${baseTokenSymbol}`);
    if (response.data && response.data.price) {
      console.log(`[Uniswap] 从Binance获取的价格: ${response.data.price}`);
      return parseFloat(response.data.price);
    }
    return null;
  } catch (error) {
    console.error(`从Binance获取价格失败:`, error);
    return null;
  }
}

/**
 * 从OKX获取价格
 */
async function getOkxPrice(tokenSymbol: string, baseTokenSymbol: string): Promise<number | null> {
  try {
    const response = await axios.get(`https://www.okx.com/api/v5/market/ticker?instId=${tokenSymbol}-${baseTokenSymbol}`);
    if (response.data && 
        response.data.data && 
        response.data.data.length > 0 && 
        response.data.data[0].last) {
      console.log(`[Uniswap] 从OKX获取的价格: ${response.data.data[0].last}`);
      return parseFloat(response.data.data[0].last);
    }
    return null;
  } catch (error) {
    console.error(`从OKX获取价格失败:`, error);
    return null;
  }
}

/**
 * 从Coinbase获取价格
 */
async function getCoinbasePrice(tokenSymbol: string, baseTokenSymbol: string): Promise<number | null> {
  try {
    const response = await axios.get(`https://api.coinbase.com/v2/prices/${tokenSymbol}-${baseTokenSymbol}/spot`);
    if (response.data && response.data.data && response.data.data.amount) {
      console.log(`[Uniswap] 从Coinbase获取的价格: ${response.data.data.amount}`);
      return parseFloat(response.data.data.amount);
    }
    return null;
  } catch (error) {
    console.error(`从Coinbase获取价格失败:`, error);
    return null;
  }
}

/**
 * 从PancakeSwap获取价格
 */
async function getPancakeSwapPrice(tokenSymbol: string, baseTokenSymbol: string): Promise<number | null> {
  try {
    // 需要使用正确的PancakeSwap API格式
    // 使用v2 API需要合约地址，而不是代币符号
    // 这里我们尝试使用CoinGecko作为备选方案
    console.log(`尝试通过CoinGecko获取 ${tokenSymbol} 在BSC上的价格...`);
    
    // 先通过CoinGecko搜索获取代币ID
    const searchResponse = await axios.get(
      `https://api.coingecko.com/api/v3/search?query=${tokenSymbol}`
    );
    
    if (searchResponse.data && 
        searchResponse.data.coins && 
        searchResponse.data.coins.length > 0) {
      
      // 找到最匹配的代币
      const exactSymbolMatch = searchResponse.data.coins.find(
        (coin: any) => coin.symbol.toLowerCase() === tokenSymbol.toLowerCase()
      );
      
      const bestMatch = exactSymbolMatch || searchResponse.data.coins[0];
      const coinId = bestMatch.id;
      
      // 使用找到的ID获取价格
      const priceResponse = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${baseTokenSymbol.toLowerCase()}`
      );
      
      if (priceResponse.data && 
          priceResponse.data[coinId] && 
          priceResponse.data[coinId][baseTokenSymbol.toLowerCase()]) {
        console.log(`通过CoinGecko获取的${tokenSymbol}价格: ${priceResponse.data[coinId][baseTokenSymbol.toLowerCase()]}`);
        return priceResponse.data[coinId][baseTokenSymbol.toLowerCase()];
      }
    }
    
    return null;
  } catch (error) {
    console.error(`从PancakeSwap获取价格失败:`, error);
    return null;
  }
}

/**
 * 从dYdX获取价格
 */
async function getDydxPrice(tokenSymbol: string, baseTokenSymbol: string): Promise<number | null> {
  try {
    // dYdX API可能不支持所有交易对，我们使用更通用的方法
    // 尝试使用CoinGecko作为备选方案
    console.log(`尝试通过CoinGecko获取 ${tokenSymbol} 价格...`);
    
    // 通过CoinGecko搜索获取代币ID
    const searchResponse = await axios.get(
      `https://api.coingecko.com/api/v3/search?query=${tokenSymbol}`
    );
    
    if (searchResponse.data && 
        searchResponse.data.coins && 
        searchResponse.data.coins.length > 0) {
      
      // 找到最匹配的代币
      const exactSymbolMatch = searchResponse.data.coins.find(
        (coin: any) => coin.symbol.toLowerCase() === tokenSymbol.toLowerCase()
      );
      
      const bestMatch = exactSymbolMatch || searchResponse.data.coins[0];
      const coinId = bestMatch.id;
      
      // 使用找到的ID获取价格
      const priceResponse = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${baseTokenSymbol.toLowerCase()}`
      );
      
      if (priceResponse.data && 
          priceResponse.data[coinId] && 
          priceResponse.data[coinId][baseTokenSymbol.toLowerCase()]) {
        console.log(`通过CoinGecko获取的${tokenSymbol}价格: ${priceResponse.data[coinId][baseTokenSymbol.toLowerCase()]}`);
        return priceResponse.data[coinId][baseTokenSymbol.toLowerCase()];
      }
    }
    
    return null;
  } catch (error) {
    console.error(`从dYdX获取价格失败:`, error);
    return null;
  }
}

/**
 * 从CoinGecko获取价格
 */
async function getCoinGeckoPrice(tokenSymbol: string, baseTokenSymbol: string): Promise<number | null> {
  try {
    // 使用tokenResolver获取代币信息
    const tokenInfo = await resolveToken(tokenSymbol);
    const baseTokenInfo = await resolveToken(baseTokenSymbol);
    
    if (!tokenInfo) {
      console.log(`未找到代币: ${tokenSymbol}`);
      return null;
    }
    
    // 如果代币信息来自CoinGecko，可能已经有了id
    if (tokenInfo.source === 'coingecko' && tokenInfo.id) {
      try {
        const response = await axios.get(
          `https://api.coingecko.com/api/v3/simple/price?ids=${tokenInfo.id}&vs_currencies=${baseTokenSymbol.toLowerCase()}`
        );
        
        if (response.data && 
            response.data[tokenInfo.id] && 
            response.data[tokenInfo.id][baseTokenSymbol.toLowerCase()]) {
          return response.data[tokenInfo.id][baseTokenSymbol.toLowerCase()];
        }
      } catch (error) {
        console.log(`使用cached id获取价格失败，尝试搜索...`);
      }
    }
    
    // 通过搜索API找到代币ID
    const searchResponse = await axios.get(
      `https://api.coingecko.com/api/v3/search?query=${tokenSymbol}`
    );
    
    if (searchResponse.data && searchResponse.data.coins && searchResponse.data.coins.length > 0) {
      // 尝试找到最匹配的代币
      const exactSymbolMatch = searchResponse.data.coins.find(
        (coin: any) => coin.symbol.toLowerCase() === tokenSymbol.toLowerCase()
      );
      
      const bestMatch = exactSymbolMatch || searchResponse.data.coins[0];
      const coinId = bestMatch.id;
      
      // 使用找到的ID获取价格
      const priceResponse = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${baseTokenSymbol.toLowerCase()}`
      );
      
      if (priceResponse.data && 
          priceResponse.data[coinId] && 
          priceResponse.data[coinId][baseTokenSymbol.toLowerCase()]) {
        return priceResponse.data[coinId][baseTokenSymbol.toLowerCase()];
      }
    }
    
    return null;
  } catch (error) {
    console.error(`从CoinGecko获取${tokenSymbol}价格失败:`, error);
    return null;
  }
}

export default {
  uniswapAPI,
  raydiumAPI,
  getDexApi,
  getPriceAcrossDexes,
  isTokenSupported
}; 