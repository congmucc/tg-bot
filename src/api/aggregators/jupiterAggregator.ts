import axios from 'axios';
import { API_CONFIG } from '../../config/env';
import { tokens } from '../../config/tokens';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ExchangeType, BlockchainType, PriceResult, IPriceAggregator } from '../interfaces/exchangeApi';

// 代币缓存，避免重复请求
const tokenCache: {[key: string]: any} = {};

/**
 * 代币精度信息
 */
interface TokenDecimalsInfo {
  [symbol: string]: number;
}

// 维护代币精度信息
const tokenDecimals: TokenDecimalsInfo = {
  SOL: 9,    // SOL精度为9
  USDC: 6,   // USDC精度为6
  USDT: 6,   // USDT精度为6
  WIF: 6,    // WIF精度为6
  BONK: 5,   // BONK精度为5
};

/**
 * Jupiter聚合器
 * 用于聚合Solana上的DEX价格
 */
class JupiterAggregator implements IPriceAggregator {
  /**
   * 获取聚合器名称
   */
  public getName(): string {
    return 'jupiter';
  }

  /**
   * 从多个交易所获取价格
   * @param tokenSymbol 代币符号
   * @param baseTokenSymbol 基础代币符号
   * @returns 各交易所价格结果
   */
  public async getPrices(tokenSymbol: string, baseTokenSymbol: string = 'USDC'): Promise<PriceResult[]> {
    try {
      const price = await this.getTokenPrice(tokenSymbol, baseTokenSymbol);
      return [price];
    } catch (error) {
      console.error(`[Jupiter] 获取价格失败:`, error);
      return [{
        exchange: this.getName(),
        exchangeType: ExchangeType.AGGREGATOR,
        blockchain: BlockchainType.SOLANA,
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }];
    }
  }

  /**
   * 检测价格异常值
   * @param prices 价格结果数组
   * @returns 处理后的价格结果数组
   */
  public detectOutliers(prices: PriceResult[]): PriceResult[] {
    // 由于Jupiter本身已经聚合了多个DEX，这里不需要额外检测异常值
    return prices;
  }

  /**
   * 获取最佳价格
   * @param prices 价格结果数组
   * @returns 最佳价格结果
   */
  public getBestPrice(prices: PriceResult[]): PriceResult | null {
    const successfulPrices = prices.filter(p => p.success && p.price !== undefined);
    if (successfulPrices.length === 0) return null;
    
    // 对于Jupiter，直接返回第一个成功的价格即可
    return successfulPrices[0];
  }

  /**
   * 获取价格统计信息
   * @param prices 价格结果数组
   * @returns 价格统计信息
   */
  public getPriceStats(prices: PriceResult[]): {
    lowest?: PriceResult;
    highest?: PriceResult;
    average?: number;
    median?: number;
    diff?: number;
  } {
    const successfulPrices = prices.filter(p => p.success && p.price !== undefined);
    if (successfulPrices.length === 0) return {};
    
    // 对于Jupiter，只有一个价格源，所以所有统计数据都是相同的
    const price = successfulPrices[0];
    return {
      lowest: price,
      highest: price,
      average: price.price,
      median: price.price,
      diff: 0
    };
  }

  /**
   * 通过符号查找代币地址
   * @param symbol 代币符号
   * @returns 代币地址或null
   */
  public async getTokenAddressBySymbol(symbol: string): Promise<string | null> {
    try {
      // 检查缓存
      if (tokenCache[symbol.toUpperCase()]) {
        console.log(`[Jupiter] 从缓存获取代币地址: ${symbol} -> ${tokenCache[symbol.toUpperCase()].address}`);
        return tokenCache[symbol.toUpperCase()].address;
      }
      
      // 特殊处理SOL和其他常用代币
      const upperSymbol = symbol.toUpperCase();

      // 从Solana代币配置中获取地址
      const solanaToken = tokens.solana[upperSymbol];
      if (solanaToken) {
        console.log(`[Jupiter] 使用预设地址: ${upperSymbol} -> ${solanaToken.address}`);
        return solanaToken.address === 'native' ? 'So11111111111111111111111111111111111111112' : solanaToken.address;
      }

      // 特殊处理一些映射
      if (upperSymbol === 'BTC') {
        // Solana上没有原生BTC，尝试查找包装版本
        console.log(`[Jupiter] BTC在Solana上不存在，将通过API查找`);
      } else if (upperSymbol === 'ETH') {
        // 使用Solana上的WETH
        const wethToken = tokens.solana['WETH'];
        if (wethToken) {
          console.log(`[Jupiter] 使用WETH代替ETH: ${wethToken.address}`);
          return wethToken.address;
        }
      }
      
      console.log(`[Jupiter] 获取代币列表...`);
      const response = await axios.get(API_CONFIG.JUPITER_TOKEN_LIST_API);
      
      if (!response.data || !Array.isArray(response.data)) {
        console.error('[Jupiter] 获取代币列表失败: 无效响应');
        return null;
      }
      
      // 查找匹配的代币
      const token = response.data.find((t: any) => 
        t.symbol.toUpperCase() === upperSymbol ||
        t.name.toUpperCase() === upperSymbol
      );
      
      if (token) {
        console.log(`[Jupiter] 找到代币: ${token.symbol} (${token.name}) - ${token.address}`);
        
        // 保存精度信息
        if (token.decimals !== undefined) {
          tokenDecimals[token.symbol.toUpperCase()] = token.decimals;
        }
        
        // 缓存代币信息
        tokenCache[token.symbol.toUpperCase()] = token;
        
        return token.address;
      }
      
      console.log(`[Jupiter] 未找到代币: ${symbol}`);
      return null;
    } catch (error: any) {
      console.error('[Jupiter] 获取代币地址失败:', error.message);
      return null;
    }
  }

  /**
   * 获取代币精度
   * @param symbol 代币符号或地址
   * @returns 代币精度
   */
  public async getTokenDecimals(symbol: string): Promise<number | null> {
    try {
      const upperSymbol = symbol.toUpperCase();
      
      // 检查缓存中是否有精度信息
      if (tokenDecimals[upperSymbol] !== undefined) {
        return tokenDecimals[upperSymbol];
      }
      
      // 如果是地址，尝试从缓存中找到对应的代币
      for (const key in tokenCache) {
        if (tokenCache[key].address === symbol) {
          if (tokenCache[key].decimals !== undefined) {
            return tokenCache[key].decimals;
          }
          break;
        }
      }
      
      console.log(`[Jupiter] 获取代币 ${symbol} 的精度信息...`);
      
      // 尝试获取代币信息
      const address = symbol.length > 10 ? symbol : await this.getTokenAddressBySymbol(symbol);
      if (!address) {
        return null;
      }
      
      // 从代币列表获取
      const response = await axios.get(API_CONFIG.JUPITER_TOKEN_LIST_API);
      
      if (!response.data || !Array.isArray(response.data)) {
        console.error('[Jupiter] 获取代币列表失败: 无效响应');
        return null;
      }
      
      // 查找匹配的代币
      const token = response.data.find((t: any) => t.address === address);
      
      if (token && token.decimals !== undefined) {
        console.log(`[Jupiter] 找到代币精度: ${upperSymbol} = ${token.decimals}`);
        
        // 缓存精度信息
        tokenDecimals[upperSymbol] = token.decimals;
        return token.decimals;
      }
      
      // 默认值
      if (upperSymbol === 'SOL') return 9;
      if (upperSymbol === 'USDC' || upperSymbol === 'USDT') return 6;
      
      return null;
    } catch (error: any) {
      console.error(`[Jupiter] 获取代币精度失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取代币价格
   * @param tokenSymbol 代币符号
   * @param baseSymbol 基础代币符号
   * @returns 价格结果
   */
  public async getTokenPrice(tokenSymbol: string, baseSymbol: string = 'USDC'): Promise<PriceResult> {
    try {
      console.log(`[Jupiter] 获取价格: ${tokenSymbol}/${baseSymbol}`);
      
      // 获取代币地址
      const tokenAddress = await this.getTokenAddressBySymbol(tokenSymbol);
      if (!tokenAddress) {
        return {
          exchange: this.getName(),
          exchangeType: ExchangeType.AGGREGATOR,
          blockchain: BlockchainType.SOLANA,
          success: false,
          error: `未找到代币地址: ${tokenSymbol}`
        };
      }
      
      const baseAddress = await this.getTokenAddressBySymbol(baseSymbol);
      if (!baseAddress) {
        return {
          exchange: this.getName(),
          exchangeType: ExchangeType.AGGREGATOR,
          blockchain: BlockchainType.SOLANA,
          success: false,
          error: `未找到基础代币地址: ${baseSymbol}`
        };
      }
      
      console.log(`[Jupiter] 代币地址: ${tokenSymbol}=${tokenAddress}, ${baseSymbol}=${baseAddress}`);
      
      // 获取代币精度信息
      const tokenDecimal = await this.getTokenDecimals(tokenAddress);
      const baseTokenDecimal = await this.getTokenDecimals(baseAddress);
      
      console.log(`[Jupiter] 代币精度: ${tokenSymbol}=${tokenDecimal}, ${baseSymbol}=${baseTokenDecimal}`);
      
      // 首先尝试使用交易API获取价格（更可靠）
      try {
        console.log('[Jupiter] 尝试使用交易API获取价格...');
        
        // 设置输入金额为1个代币（考虑精度）
        const inputAmount = LAMPORTS_PER_SOL; // 默认1个SOL或等价金额
        console.log(`[Jupiter] 输入金额: ${inputAmount} (1 ${tokenSymbol})`);
        
        const quoteResponse = await axios.get(API_CONFIG.JUPITER_SWAP_API, {
          params: {
            inputMint: tokenAddress,
            outputMint: baseAddress,
            amount: inputAmount,
            slippageBps: 50
          },
          timeout: 10000 // 10秒超时
        });
        
        if (quoteResponse.data && quoteResponse.data.outAmount && quoteResponse.data.inAmount) {
          const outAmount = Number(quoteResponse.data.outAmount);
          const inAmount = Number(quoteResponse.data.inAmount);
          
          if (outAmount && inAmount) {
            // 获取精度调整后的输入输出金额
            const adjustedOutAmount = tokenDecimal && baseTokenDecimal 
              ? outAmount / Math.pow(10, baseTokenDecimal)
              : outAmount;
            
            const adjustedInAmount = tokenDecimal 
              ? inAmount / Math.pow(10, tokenDecimal)
              : inAmount;
            
            console.log(`[Jupiter] 原始输出金额: ${outAmount}, 精度调整后: ${adjustedOutAmount}`);
            console.log(`[Jupiter] 原始输入金额: ${inAmount}, 精度调整后: ${adjustedInAmount}`);
            
            // 计算价格 (输出金额/输入金额)
            const price = adjustedOutAmount / adjustedInAmount;
            
            console.log(`[Jupiter] ${tokenSymbol}/${baseSymbol} 价格 (通过交易API): ${price}`);
            return {
              exchange: this.getName(),
              exchangeType: ExchangeType.AGGREGATOR,
              blockchain: BlockchainType.SOLANA,
              success: true,
              price: price,
              timestamp: Date.now()
            };
          }
        }
      } catch (error: any) {
        console.error('[Jupiter] 使用交易API获取价格失败:', error.message);
        console.log('[Jupiter] 尝试使用价格API...');
      }
      
      // 如果交易API失败，尝试使用价格API
      try {
        // 使用新版的Jupiter V2 Price API
        const response = await axios.get(API_CONFIG.JUPITER_PRICE_API, {
          params: {
            id: tokenAddress,
            vsToken: baseAddress
          },
          timeout: 5000 // 5秒超时
        });
        
        // V2 API的响应格式变化
        if (response.data && response.data.data && response.data.data.price) {
          const price = response.data.data.price;
          
          console.log(`[Jupiter] ${tokenSymbol}/${baseSymbol} 价格 (通过价格API): ${price}`);
          return {
            exchange: this.getName(),
            exchangeType: ExchangeType.AGGREGATOR,
            blockchain: BlockchainType.SOLANA,
            success: true,
            price: price,
            timestamp: Date.now()
          };
        }
        
        console.log(`[Jupiter] 价格API未返回有效数据`);
        return {
          exchange: this.getName(),
          exchangeType: ExchangeType.AGGREGATOR,
          blockchain: BlockchainType.SOLANA,
          success: false,
          error: '价格API未返回有效数据'
        };
      } catch (error: any) {
        console.error('[Jupiter] 使用价格API获取价格失败:', error.message);
        return {
          exchange: this.getName(),
          exchangeType: ExchangeType.AGGREGATOR,
          blockchain: BlockchainType.SOLANA,
          success: false,
          error: error.message || '获取价格失败'
        };
      }
    } catch (error: any) {
      console.error(`[Jupiter] 获取价格失败:`, error.message);
      return {
        exchange: this.getName(),
        exchangeType: ExchangeType.AGGREGATOR,
        blockchain: BlockchainType.SOLANA,
        success: false,
        error: error.message || '获取价格失败'
      };
    }
  }

  /**
   * 搜索代币
   * @param query 搜索关键词
   * @returns 匹配的代币列表
   */
  public async searchToken(query: string): Promise<Array<any>> {
    try {
      console.log(`[Jupiter] 搜索代币: ${query}`);
      
      const response = await axios.get(API_CONFIG.JUPITER_TOKEN_LIST_API);
      
      if (!response.data || !Array.isArray(response.data)) {
        console.error('[Jupiter] 获取代币列表失败: 无效响应');
        return [];
      }
      
      // 搜索匹配的代币
      const searchQuery = query.toLowerCase();
      const matchingTokens = response.data.filter((t: any) => {
        const symbol = t.symbol.toLowerCase();
        const name = t.name.toLowerCase();
        
        return symbol.includes(searchQuery) || 
               name.includes(searchQuery) || 
               searchQuery.includes(symbol);
      }).slice(0, 10); // 限制结果数量
      
      if (matchingTokens.length > 0) {
        console.log(`[Jupiter] 找到 ${matchingTokens.length} 个匹配的代币`);
        
        // 对结果添加价格信息
        const tokensWithPrice = await Promise.all(matchingTokens.map(async (token) => {
          try {
            const priceResult = await this.getTokenPrice(token.symbol);
            return {
              ...token,
              price: priceResult.success ? priceResult.price : null
            };
          } catch (error) {
            return {
              ...token,
              price: null
            };
          }
        }));
        
        return tokensWithPrice;
      } else {
        console.log(`[Jupiter] 未找到匹配的代币: ${query}`);
        return [];
      }
    } catch (error: any) {
      console.error('[Jupiter] 搜索代币失败:', error.message);
      return [];
    }
  }
}

// 导出单例实例
const jupiterAggregator = new JupiterAggregator();
export default jupiterAggregator; 