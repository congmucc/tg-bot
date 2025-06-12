import { dexApis, aggregators } from '../api';
import { getCryptoPrices, getFearAndGreedIndex as getFnG } from '../utils/crypto/cryptoUtils';
import { tokens } from '../config/tokens';
import HttpClient from '../utils/http/httpClient';
import { getTokenBySymbol } from '../config/tokens';
import { config } from '../config';
import jupiterAggregator from '../api/aggregators/jupiterAggregator';

// 创建HttpClient实例
const http = HttpClient.create();
const coingeckoHttp = HttpClient.create('https://api.coingecko.com/api/v3');
const binanceHttp = HttpClient.create('https://api.binance.com');
const okxHttp = HttpClient.create('https://www.okx.com');
const alternativeHttp = HttpClient.create('https://api.alternative.me');

/**
 * 加密货币价格信息接口
 */
interface CryptoPrice {
  market_data: {
    current_price: {
      usd: number;
      cny?: number;
    };
    price_change_percentage_24h: number;
    market_cap: {
      usd: number;
    };
  };
}

/**
 * 获取恐惧贪婪指数接口
 */
interface FNGResponse {
  name: string;
  data: {
    value: string;
    value_classification: string;
    timestamp: string;
    time_until_update: string;
  }[];
}

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
    // 常见代币符号到CoinGecko ID的映射
    const symbolToId: {[key: string]: string} = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'SOL': 'solana',
      'BNB': 'binancecoin',
      'USDT': 'tether',
      'USDC': 'usd-coin',
      'XRP': 'ripple',
      'ADA': 'cardano',
      'DOGE': 'dogecoin',
      'DOT': 'polkadot',
      'LINK': 'chainlink',
      'AVAX': 'avalanche-2',
      'MATIC': 'matic-network',
      'SHIB': 'shiba-inu',
      'LTC': 'litecoin',
      'ATOM': 'cosmos',
      'UNI': 'uniswap',
      'BCH': 'bitcoin-cash',
      'TRX': 'tron',
      'XLM': 'stellar'
    };
    
    // 首先尝试使用映射查找常见代币
    if (symbolToId[tokenSymbol.toUpperCase()]) {
      try {
        const result = await getTokenPriceFromCoinGecko(symbolToId[tokenSymbol.toUpperCase()]);
        if (result.success) {
          return {
            ...result,
            source: 'CoinGecko'
          };
        }
      } catch (error) {
        // 如果失败，继续尝试其他方法
        console.log(`通过ID获取${tokenSymbol}价格失败，尝试其他方法`);
      }
    }
    
    // 对于Solana代币，优先使用Jupiter聚合器
    if (tokenSymbol.toUpperCase() === 'SOL' || getTokenBySymbol(tokenSymbol, 'solana')) {
      try {
        console.log(`尝试使用Jupiter聚合器获取${tokenSymbol}价格`);
        const priceResults = await jupiterAggregator.getPrices(tokenSymbol, 'USDC');
        const bestPrice = jupiterAggregator.getBestPrice(priceResults);
        
        if (bestPrice && bestPrice.success && bestPrice.price !== undefined) {
          return {
            success: true,
            usdPrice: bestPrice.price,
            source: 'Jupiter'
          };
        }
      } catch (error) {
        console.error(`Jupiter获取${tokenSymbol}价格失败:`, error);
      }
    }
    
    // 尝试在以太坊和Solana上查找代币
    const ethereumToken = getTokenBySymbol(tokenSymbol, 'ethereum');
    const solanaToken = getTokenBySymbol(tokenSymbol, 'solana');
    
    // 如果没有找到代币
    if (!ethereumToken && !solanaToken) {
      // 尝试直接使用符号作为ID查询
      try {
        const result = await getTokenPriceFromCoinGecko(tokenSymbol.toLowerCase());
        if (result.success) {
          return {
            ...result,
            source: 'CoinGecko'
          };
        }
        return result;
      } catch (coinGeckoError) {
        return {
          success: false,
          error: `未找到代币 ${tokenSymbol}`
        };
      }
    }

    // 确定要使用的代币地址和链类型
    const token = ethereumToken || solanaToken;
    const chain = ethereumToken ? 'ethereum' : 'solana';
    
    // 对于特殊代币，直接从CoinGecko获取价格
    // 处理BTC等原生代币
    if (tokenSymbol.toUpperCase() === 'BTC') {
      const result = await getTokenPriceFromCoinGecko('bitcoin');
      if (result.success) {
        return {
          ...result,
          source: 'CoinGecko'
        };
      }
      return result;
    }

    if (tokenSymbol.toUpperCase() === 'ETH') {
      const result = await getTokenPriceFromCoinGecko('ethereum');
      if (result.success) {
        return {
          ...result,
          source: 'CoinGecko'
        };
      }
      return result;
    }
    
    // 普通代币，使用具体地址尝试获取价格
    try {
      const coinId = chain === 'ethereum' 
        ? `ethereum:${token!.address}` 
        : `solana:${token!.address}`;
        
      const result = await getTokenPriceFromCoinGecko(coinId);
      if (result.success) {
        return {
          ...result,
          source: 'CoinGecko'
        };
      }
      return result;
    } catch (error) {
      // 如果链地址查询失败，尝试直接使用代币符号
      console.log(`通过地址获取${tokenSymbol}价格失败，尝试直接使用符号`);
      try {
        const result = await getTokenPriceFromCoinGecko(tokenSymbol.toLowerCase());
        if (result.success) {
          return {
            ...result,
            source: 'CoinGecko'
          };
        }
        return result;
      } catch (e) {
        // 尝试从中心化交易所获取价格
        const cexResult = await getCexTokenPrice(tokenSymbol);
        if (cexResult.success && cexResult.price) {
          return {
            success: true,
            usdPrice: cexResult.price,
            source: cexResult.source || 'CEX'
          };
        }
        
        const err = e as Error;
        return {
          success: false,
          error: `获取${tokenSymbol}价格失败: ${err.message}`
        };
      }
    }
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      error: `获取${tokenSymbol}价格失败: ${err.message}`
    };
  }
}

/**
 * 从CoinGecko获取代币价格
 * @param coinId CoinGecko上的代币ID
 */
async function getTokenPriceFromCoinGecko(coinId: string): Promise<{
  success: boolean;
  usdPrice?: number;
  cnyPrice?: number;
  priceChange24h?: number;
  error?: string;
}> {
  try {
    // 尝试获取详细价格信息，包括24小时变化
    try {
      const detailResponse = await coingeckoHttp.get(
        `/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`
      );
      
      if (detailResponse.data && detailResponse.data.market_data) {
        const marketData = detailResponse.data.market_data;
        return {
          success: true,
          usdPrice: marketData.current_price.usd,
          cnyPrice: marketData.current_price.cny,
          priceChange24h: marketData.price_change_percentage_24h
        };
      }
    } catch (error) {
      console.log(`获取${coinId}详细价格信息失败，尝试简单价格查询`);
    }
    
    // 如果详细查询失败，使用简单价格查询
    const response = await coingeckoHttp.get(
      `/simple/price?ids=${coinId}&vs_currencies=usd,cny`
    );
    
    const data = response.data;
    const id = coinId.includes(':') ? coinId.split(':')[1] : coinId;
    
    if (!data[id]) {
      return {
        success: false,
        error: `在CoinGecko上未找到代币 ${id}`
      };
    }
    
    return {
      success: true,
      usdPrice: data[id].usd,
      cnyPrice: data[id].cny
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      error: `获取价格失败: ${err.message}`
    };
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
 * 获取交易对在DEX上的价格
 * @param baseToken 基础代币
 * @param quoteToken 交易代币
 */
export async function getPairPrices(baseToken: string, quoteToken: string) {
  try {
    // 使用新的dexApis从每个DEX获取价格
    const pricePromises = Object.values(dexApis).map(api => 
      api.getTokenPrice(baseToken, quoteToken)
    );
    
    const results = await Promise.all(pricePromises);
    
    return {
      pair: `${baseToken}/${quoteToken}`,
      prices: results,
      success: true
    };
  } catch (error) {
    const err = error as Error;
    return {
      pair: `${baseToken}/${quoteToken}`,
      error: err.message,
      success: false
    };
  }
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
    // 主流代币列表 - 增加更多主流代币
    const commonTokens = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'BNB', 'XRP', 'DOGE', 'ADA', 'DOT'];
    const results = [];

    for (const symbol of commonTokens) {
      try {
        const priceData = await getTokenPrice(symbol);
        
        if (priceData.success && priceData.usdPrice) {
          results.push({
            symbol,
            price: priceData.usdPrice,
            formattedPrice: formatTokenPrice(priceData.usdPrice)
          });
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
 * 获取加密货币价格
 * @param symbol 代币符号
 */
export async function getCryptoPrice(symbol: string): Promise<CryptoPrice> {
  try {
    // 创建常见代币符号到ID的映射
    const symbolToId: {[key: string]: string} = {
      'btc': 'bitcoin',
      'eth': 'ethereum',
      'sol': 'solana',
      'bnb': 'binancecoin',
      'usdt': 'tether',
      'usdc': 'usd-coin',
      'xrp': 'ripple',
      'ada': 'cardano',
      'doge': 'dogecoin',
      'dot': 'polkadot',
    };
    
    // 获取正确的ID
    const id = symbolToId[symbol.toLowerCase()] || symbol.toLowerCase();
    
    // 调用API
    const response = await coingeckoHttp.get(`/coins/${id}`);
    return response.data;
  } catch (error) {
    const err = error as Error;
    throw new Error(`获取价格失败: ${err.message}`);
  }
}

/**
 * 获取恐惧贪婪指数
 */
export async function getFearAndGreedIndex(): Promise<FNGResponse> {
  try {
    // 使用已经导入的工具函数
    return await getFnG();
  } catch (error) {
    const err = error as Error;
    throw new Error(`获取恐惧贪婪指数失败: ${err.message}`);
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
  error?: string;
}> {
  try {
    const symbolUpper = symbol.toUpperCase();
    
    // 尝试从Binance获取价格
    try {
      // 尝试常见的交易对组合
      const tradingPairs = ['USDT', 'USDC', 'USD', 'BTC', 'ETH'];
      
      for (const pair of tradingPairs) {
        try {
          const response = await binanceHttp.get(`/api/v3/ticker/price`, { 
            symbol: `${symbolUpper}${pair}` 
          }, {
            timeout: 5000
          });
          
          if (response.data && response.data.price) {
            // 如果基础货币是BTC或ETH，需要转换为USD
            if (pair === 'BTC' || pair === 'ETH') {
              // 获取BTC或ETH的USD价格
              const basePriceResponse = await binanceHttp.get(`/api/v3/ticker/price`, { 
                symbol: `${pair}USDT` 
              }, {
                timeout: 3000
              });
              
              if (basePriceResponse.data && basePriceResponse.data.price) {
                const basePrice = parseFloat(basePriceResponse.data.price);
                const tokenPrice = parseFloat(response.data.price);
                return {
                  success: true,
                  price: tokenPrice * basePrice,
                  source: 'Binance'
                };
              }
            } else {
              return {
                success: true,
                price: parseFloat(response.data.price),
                source: 'Binance'
              };
            }
          }
        } catch (pairError) {
          // 尝试下一个交易对
          continue;
        }
      }
    } catch (binanceError) {
      console.log(`从Binance获取${symbol}价格失败`);
    }
    
    // 尝试从OKX获取价格
    try {
      const tradingPairs = ['USDT', 'USDC', 'USD', 'BTC', 'ETH'];
      
      for (const pair of tradingPairs) {
        try {
          const response = await okxHttp.get(`/api/v5/market/ticker`, {
            instId: `${symbolUpper}-${pair}`
          }, {
            timeout: 5000
          });
          
          if (response.data && 
              response.data.data && 
              response.data.data.length > 0 && 
              response.data.data[0].last) {
            
            // 如果基础货币是BTC或ETH，需要转换为USD
            if (pair === 'BTC' || pair === 'ETH') {
              try {
                const basePriceResponse = await okxHttp.get(`/api/v5/market/ticker`, {
                  instId: `${pair}-USDT`
                }, {
                  timeout: 3000
                });
                
                if (basePriceResponse.data && 
                    basePriceResponse.data.data && 
                    basePriceResponse.data.data.length > 0 && 
                    basePriceResponse.data.data[0].last) {
                  const basePrice = parseFloat(basePriceResponse.data.data[0].last);
                  const tokenPrice = parseFloat(response.data.data[0].last);
                  return {
                    success: true,
                    price: tokenPrice * basePrice,
                    source: 'OKX'
                  };
                }
              } catch (error) {
                // 如果转换失败，继续尝试其他交易对
                continue;
              }
            } else {
              return {
                success: true,
                price: parseFloat(response.data.data[0].last),
                source: 'OKX'
              };
            }
          }
        } catch (pairError) {
          // 尝试下一个交易对
          continue;
        }
      }
    } catch (okxError) {
      console.log(`从OKX获取${symbol}价格失败`);
    }
    
    // 尝试从CoinGecko获取价格
    try {
      // 常见代币符号到CoinGecko ID的映射
      const symbolToId: {[key: string]: string} = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'SOL': 'solana',
        'BNB': 'binancecoin',
        'USDT': 'tether',
        'USDC': 'usd-coin',
        'XRP': 'ripple',
        'ADA': 'cardano',
        'DOGE': 'dogecoin',
        'DOT': 'polkadot',
        'LINK': 'chainlink',
        'AVAX': 'avalanche-2',
        'MATIC': 'matic-network',
        'SHIB': 'shiba-inu',
        'LTC': 'litecoin',
        'ATOM': 'cosmos',
        'UNI': 'uniswap',
        'BCH': 'bitcoin-cash',
        'TRX': 'tron',
        'XLM': 'stellar',
        'FIL': 'filecoin',
        'NEAR': 'near',
        'ALGO': 'algorand',
        'ICP': 'internet-computer',
        'EOS': 'eos'
      };
      
      // 尝试多种ID组合
      const possibleIds = [
        symbolToId[symbolUpper], // 从映射表中获取
        symbolUpper.toLowerCase(), // 全小写
        symbol.toLowerCase(), // 保持原始大小写的小写版本
        symbol.toLowerCase() + '-token', // 有些代币加token后缀
        symbol.toLowerCase() + '-protocol', // 有些代币加protocol后缀
        symbol.toLowerCase() + '-coin' // 有些代币加coin后缀
      ].filter(id => id); // 过滤掉undefined
      
      for (const coinId of possibleIds) {
        try {
          const response = await coingeckoHttp.get(`/simple/price`, {
            ids: coinId,
            vs_currencies: 'usd'
          }, {
            timeout: 5000
          });
          
          if (response.data && response.data[coinId] && response.data[coinId].usd) {
            return {
              success: true,
              price: response.data[coinId].usd,
              source: 'CoinGecko'
            };
          }
        } catch (idError) {
          // 尝试下一个ID
          continue;
        }
      }
      
      // 尝试通过搜索API找到正确的ID
      try {
        const searchResponse = await coingeckoHttp.get(`/search`, {
          query: symbol
        }, {
          timeout: 5000
        });
        
        if (searchResponse.data && 
            searchResponse.data.coins && 
            searchResponse.data.coins.length > 0) {
          
          // 获取找到的第一个结果的ID
          const foundId = searchResponse.data.coins[0].id;
          
          // 使用找到的ID获取价格
          const priceResponse = await coingeckoHttp.get(`/simple/price`, {
            ids: foundId,
            vs_currencies: 'usd'
          }, {
            timeout: 5000
          });
          
          if (priceResponse.data && 
              priceResponse.data[foundId] && 
              priceResponse.data[foundId].usd) {
            return {
              success: true,
              price: priceResponse.data[foundId].usd,
              source: 'CoinGecko (Search)'
            };
          }
        }
      } catch (searchError) {
        console.log(`CoinGecko搜索失败:`, searchError);
      }
    } catch (cgError) {
      console.log(`从CoinGecko获取${symbol}价格失败`);
    }
    
    return {
      success: false,
      error: `无法从任何交易所获取${symbol}价格`
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      error: err.message
    };
  }
}

export default {
  getTokenPrice,
  formatTokenPrice,
  calcPriceChangePercent,
  getPairPrices,
  getCommonTokenPrices,
  getCryptoPrice,
  getFearAndGreedIndex,
  getCexTokenPrice
}; 