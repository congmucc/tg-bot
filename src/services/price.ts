import axios from 'axios';
import * as dotenv from 'dotenv';
import HttpClient from '../utils/http/httpClient';
import { API_CONFIG } from '../config/env';

// 加载环境变量
dotenv.config();

// 创建HTTP客户端
const httpClient = new HttpClient(undefined, {
  timeout: 5000,
  retry: 2,
  retryDelay: 2000
});

// 价格缓存
const priceCache: Record<string, {
  price: {
    usd?: number;
    cny?: number;
    priceChange24h?: number;
  };
  timestamp: number;
}> = {};

// 缓存有效期（5分钟）
const CACHE_TTL = 5 * 60 * 1000;



/**
 * 获取代币价格信息
 * @param tokenSymbol 代币符号
 * @returns 价格信息
 */
export async function getTokenPrice(tokenSymbol: string): Promise<{
  success: boolean;
  usdPrice?: number;
  cnyPrice?: number;
  priceChange24h?: number;
  source?: string;
  error?: string;
}> {
  try {
    // 标准化代币符号
    const normalizedSymbol = tokenSymbol.toUpperCase();
    
    // 检查缓存
    if (priceCache[normalizedSymbol] && Date.now() - priceCache[normalizedSymbol].timestamp < CACHE_TTL) {
      const cachedPrice = priceCache[normalizedSymbol].price;
      return {
        success: true,
        usdPrice: cachedPrice.usd,
        cnyPrice: cachedPrice.cny,
        priceChange24h: cachedPrice.priceChange24h,
        source: 'cache'
      };
    }
    
    // 按优先级尝试不同的API源
    const apiSources = [
      {
        name: 'CoinGecko',
        fn: () => getCoinGeckoPrice(normalizedSymbol)
      },
      {
        name: 'Binance',
        fn: () => getBinancePrice(normalizedSymbol)
      },
      {
        name: 'OKX',
        fn: () => getOKXPrice(normalizedSymbol)
      },
      {
        name: 'Huobi',
        fn: () => getHuobiPrice(normalizedSymbol)
      },
      {
        name: 'CryptoCompare',
        fn: () => getCryptoComparePrice(normalizedSymbol)
      },
      {
        name: 'CoinCap',
        fn: () => getCoinCapPrice(normalizedSymbol)
      }
    ];

    // 依次尝试每个API源
    for (const source of apiSources) {
      try {
        console.log(`正在从${source.name}获取${normalizedSymbol}价格...`);
        const result = await source.fn();

        if (result.success && result.usdPrice) {
          // 更新缓存
          priceCache[normalizedSymbol] = {
            price: {
              usd: result.usdPrice,
              cny: (result as any).cnyPrice,
              priceChange24h: (result as any).priceChange24h
            },
            timestamp: Date.now()
          };

          console.log(`✅ ${source.name}成功获取${normalizedSymbol}价格: $${result.usdPrice}`);
          return {
            success: true,
            usdPrice: result.usdPrice,
            cnyPrice: (result as any).cnyPrice,
            priceChange24h: (result as any).priceChange24h,
            source: source.name
          };
        }
      } catch (error) {
        console.log(`❌ ${source.name}获取${normalizedSymbol}价格失败: ${(error as Error).message}`);
        // 继续尝试下一个API源
      }
    }

    // 所有API都失败
    return {
      success: false,
      error: '所有价格API都无法获取数据'
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      error: `获取${tokenSymbol}价格失败: ${err.message}`
    };
  }
}

/**
 * 从CoinGecko获取价格
 */
async function getCoinGeckoPrice(symbol: string): Promise<{
  success: boolean;
  usdPrice?: number;
  cnyPrice?: number;
  priceChange24h?: number;
  error?: string;
}> {
  try {
    const coingeckoId = symbol.toLowerCase(); // 简化处理，直接使用小写符号
    const response = await httpClient.get(
      `https://api.coingecko.com/api/v3/coins/${coingeckoId}`,
      {
        params: {
          localization: false,
          tickers: false,
          market_data: true,
          community_data: false,
          developer_data: false
        }
      }
    );

    if (response.data && response.data.market_data) {
      const marketData = response.data.market_data;
      const usdPrice = marketData.current_price?.usd;

      if (usdPrice) {
        return {
          success: true,
          usdPrice,
          cnyPrice: marketData.current_price?.cny,
          priceChange24h: marketData.price_change_percentage_24h
        };
      }
    }

    return { success: false, error: 'No price data found' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * 从Binance获取价格
 */
async function getBinancePrice(symbol: string): Promise<{
  success: boolean;
  usdPrice?: number;
  error?: string;
}> {
  try {
    const binanceSymbol = `${symbol}USDT`;
    const response = await httpClient.get(API_CONFIG.BINANCE_TICKER_API, {
      params: { symbol: binanceSymbol }
    });

    if (response.data && response.data.price) {
      return {
        success: true,
        usdPrice: parseFloat(response.data.price)
      };
    }

    return { success: false, error: 'No price data found' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * 从OKX获取价格
 */
async function getOKXPrice(symbol: string): Promise<{
  success: boolean;
  usdPrice?: number;
  error?: string;
}> {
  try {
    const response = await httpClient.get(API_CONFIG.OKX_TICKER_API, {
      params: { instId: `${symbol}-USDT` }
    });

    if (response.data && response.data.code === '0' && response.data.data && response.data.data.length > 0) {
      return {
        success: true,
        usdPrice: parseFloat(response.data.data[0].last)
      };
    }

    return { success: false, error: 'No price data found' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * 从Huobi获取价格
 */
async function getHuobiPrice(symbol: string): Promise<{
  success: boolean;
  usdPrice?: number;
  error?: string;
}> {
  try {
    const response = await httpClient.get(`${API_CONFIG.HUOBI_API_BASE_URL}/market/detail/merged`, {
      params: { symbol: `${symbol.toLowerCase()}usdt` }
    });

    if (response.data && response.data.status === 'ok' && response.data.tick) {
      const price = (response.data.tick.bid[0] + response.data.tick.ask[0]) / 2;
      return {
        success: true,
        usdPrice: price
      };
    }

    return { success: false, error: 'No price data found' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * 从CryptoCompare获取价格
 */
async function getCryptoComparePrice(symbol: string): Promise<{
  success: boolean;
  usdPrice?: number;
  cnyPrice?: number;
  priceChange24h?: number;
  error?: string;
}> {
  try {
    const response = await httpClient.get('https://min-api.cryptocompare.com/data/price', {
      params: {
        fsym: symbol,
        tsyms: 'USD,CNY'
      }
    });

    if (response.data && response.data.USD) {
      return {
        success: true,
        usdPrice: response.data.USD,
        cnyPrice: response.data.CNY
      };
    }

    return { success: false, error: 'No price data found' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * 从CoinCap获取价格
 */
async function getCoinCapPrice(symbol: string): Promise<{
  success: boolean;
  usdPrice?: number;
  priceChange24h?: number;
  error?: string;
}> {
  try {
    const response = await httpClient.get(`https://api.coincap.io/v2/assets`, {
      params: { search: symbol }
    });

    if (response.data && response.data.data && response.data.data.length > 0) {
      const tokenData = response.data.data.find((item: any) =>
        item.symbol.toUpperCase() === symbol.toUpperCase()
      );

      if (tokenData) {
        return {
          success: true,
          usdPrice: parseFloat(tokenData.priceUsd),
          priceChange24h: parseFloat(tokenData.changePercent24Hr)
        };
      }
    }

    return { success: false, error: 'Token not found' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * 格式化代币价格
 * @param price 价格
 * @param currency 货币符号
 * @returns 格式化后的价格
 */
export function formatTokenPrice(price: number, currency = 'USDT'): string {
  if (price === 0) {
    return `0 ${currency}`;
  }
  
  const symbol = currency === 'USD' ? '$' : currency === 'USDT' ? '₮' : currency === 'CNY' ? '¥' : '';
  
  // 对于非常小的数字使用更多小数位
  if (price < 0.0001) {
    return `${symbol}${price.toExponential(4)}`; // 非常小的数字使用科学计数法
  } else if (price < 0.001) {
    return `${symbol}${price.toFixed(6)}`; // 小于0.001的显示6位小数
  } else if (price < 0.01) {
    return `${symbol}${price.toFixed(5)}`; // 小于0.01的显示5位小数
  } else {
    // 其他情况统一保留4位小数
    return `${symbol}${price.toFixed(4)}`;
  }
}

/**
 * 计算价格变化百分比
 * @param oldPrice 旧价格
 * @param newPrice 新价格
 */
export function calcPriceChangePercent(oldPrice: number, newPrice: number): number {
  return ((newPrice - oldPrice) / oldPrice) * 100;
}



/**
 * 获取常用代币的价格
 */
export async function getCommonTokenPrices(): Promise<{
  symbol: string;
  price: number;
  formattedPrice: string;
}[]> {
  try {
    // 主流代币列表 - 只保留市值最高的几个
    const commonTokens = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB'];
    const results = [];

    for (const symbol of commonTokens) {
      try {
        console.log(`正在获取${symbol}价格...`);
        const priceData = await getTokenPrice(symbol);

        if (priceData.success && priceData.usdPrice) {
          results.push({
            symbol,
            price: priceData.usdPrice,
            formattedPrice: formatTokenPrice(priceData.usdPrice)
          });
          console.log(`✅ 成功获取${symbol}价格: $${priceData.usdPrice}`);
        } else {
          console.log(`❌ 获取${symbol}价格失败: ${priceData.error}`);
        }
      } catch (error) {
        console.error(`获取${symbol}价格失败:`, error);
        // 继续处理下一个代币
      }
    }

    // 按价格从高到低排序
    return results.sort((a, b) => b.price - a.price);
  } catch (error) {
    console.error('获取常用代币价格失败:', error);
    return [];
  }
}



/**
 * 从中心化交易所获取代币价格
 * @param symbol 代币符号
 */
export async function getCexTokenPrice(symbol: string): Promise<{
  success: boolean;
  price?: number;
  source?: string;
}> {
  try {
    // 使用API_CONFIG中的配置从Binance获取
    try {
      const response = await httpClient.get(API_CONFIG.BINANCE_TICKER_API, {
        params: { symbol: `${symbol}USDT` },
        timeout: 5000
      });

      if (response.data && response.data.price) {
        return {
          success: true,
          price: parseFloat(response.data.price),
          source: 'Binance'
        };
      }
    } catch (error) {
      console.log(`Binance获取${symbol}价格失败`);
    }
    
    // 使用API_CONFIG中的配置从Huobi获取
    try {
      const response = await httpClient.get(`${API_CONFIG.HUOBI_API_BASE_URL}/market/detail/merged`, {
        params: { symbol: `${symbol.toLowerCase()}usdt` }
      });

      if (response.data && response.data.status === 'ok' && response.data.tick) {
        return {
          success: true,
          price: (response.data.tick.bid[0] + response.data.tick.ask[0]) / 2,
          source: 'Huobi'
        };
      }
    } catch (error) {
      console.log(`Huobi获取${symbol}价格失败`);
    }
    
    // 使用API_CONFIG中的配置从OKX获取
    try {
      const response = await httpClient.get(API_CONFIG.OKX_TICKER_API, {
        params: { instId: `${symbol}-USDT` }
      });

      if (response.data && response.data.code === '0' && response.data.data && response.data.data.length > 0) {
        return {
          success: true,
          price: parseFloat(response.data.data[0].last),
          source: 'OKX'
        };
      }
    } catch (error) {
      console.log(`OKX获取${symbol}价格失败`);
    }
    
    // 如果所有交易所都失败，尝试使用价格API
    const priceData = await getTokenPrice(symbol);
    if (priceData.success && priceData.usdPrice) {
      return {
        success: true,
        price: priceData.usdPrice,
        source: 'CoinGecko'
      };
    }
    
    return { success: false };
  } catch (error) {
    console.error(`获取${symbol}价格失败`);
    return { success: false };
  }
}

// 简单的恐惧贪婪指数函数
export async function getFearAndGreedIndex(): Promise<{ value: number; classification: string }> {
  return { value: 50, classification: 'Neutral' };
}

// 导出主要函数
export { getTokenPrice as getCryptoPrice };

export default {
  getTokenPrice,
  formatTokenPrice,
  calcPriceChangePercent,
  getCommonTokenPrices,
  getCexTokenPrice,
  getCryptoPrice: getTokenPrice,
  getFearAndGreedIndex
};