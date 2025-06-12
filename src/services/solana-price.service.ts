import axios from 'axios';
import { API_CONFIG, TOKEN_ADDRESSES } from '../config/env';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

// 代币缓存，避免重复请求
const tokenCache: {[key: string]: any} = {};

/**
 * Solana价格服务类
 * 用于通过Jupiter等API获取Solana代币价格和交易信息
 */
export class SolanaPriceService {
  /**
   * 通过符号查找代币地址
   * @param symbol 代币符号
   * @returns 代币地址或null
   */
  public async getTokenAddressBySymbol(symbol: string): Promise<string | null> {
    try {
      // 检查缓存
      if (tokenCache[symbol.toUpperCase()]) {
        console.log(`[Solana] 从缓存获取代币地址: ${symbol} -> ${tokenCache[symbol.toUpperCase()].address}`);
        return tokenCache[symbol.toUpperCase()].address;
      }
      
      // 特殊处理SOL和其他常用代币
      const upperSymbol = symbol.toUpperCase();
      // 使用类型安全的方法检查代币地址
      if (upperSymbol === 'SOL') {
        console.log(`[Solana] 使用预设地址: SOL -> ${TOKEN_ADDRESSES.SOL}`);
        return TOKEN_ADDRESSES.SOL;
      } else if (upperSymbol === 'USDC') {
        return TOKEN_ADDRESSES.USDC;
      } else if (upperSymbol === 'USDT') {
        return TOKEN_ADDRESSES.USDT;
      } else if (upperSymbol === 'WIF') {
        return TOKEN_ADDRESSES.WIF;
      } else if (upperSymbol === 'BTC') {
        return TOKEN_ADDRESSES.BTC;
      } else if (upperSymbol === 'ETH') {
        return TOKEN_ADDRESSES.ETH;
      }
      
      console.log(`[Solana] 获取代币列表...`);
      const response = await axios.get(API_CONFIG.JUPITER_TOKEN_LIST_API);
      
      if (!response.data || !Array.isArray(response.data)) {
        console.error('[Solana] 获取代币列表失败: 无效响应');
        return null;
      }
      
      // 查找匹配的代币
      const token = response.data.find((t: any) => 
        t.symbol.toUpperCase() === upperSymbol ||
        t.name.toUpperCase() === upperSymbol
      );
      
      if (token) {
        console.log(`[Solana] 找到代币: ${token.symbol} (${token.name}) - ${token.address}`);
        
        // 缓存代币信息
        tokenCache[token.symbol.toUpperCase()] = token;
        
        return token.address;
      }
      
      console.log(`[Solana] 未找到代币: ${symbol}`);
      return null;
    } catch (error: any) {
      console.error('[Solana] 获取代币地址失败:', error.message);
      return null;
    }
  }

  /**
   * 获取代币精度
   * @param tokenSymbol 代币符号或地址
   * @returns 代币精度
   */
  private async getTokenDecimals(tokenSymbol: string): Promise<number> {
    try {
      const upperSymbol = tokenSymbol.toUpperCase();
      
      // 特殊处理已知代币
      if (upperSymbol === 'SOL') return 9;
      if (upperSymbol === 'USDC') return 6;
      if (upperSymbol === 'USDT') return 6;
      
      // 如果在缓存中找到
      if (tokenCache[upperSymbol] && tokenCache[upperSymbol].decimals) {
        return tokenCache[upperSymbol].decimals;
      }
      
      // 尝试从代币列表API获取
      console.log(`[Solana] 获取代币 ${tokenSymbol} 的精度信息...`);
      const response = await axios.get(API_CONFIG.JUPITER_TOKEN_LIST_API);
      
      if (response.data && Array.isArray(response.data)) {
        // 尝试通过符号或地址匹配
        const token = response.data.find((t: any) => 
          t.symbol.toUpperCase() === upperSymbol || 
          t.address === tokenSymbol
        );
        
        if (token && token.decimals) {
          console.log(`[Solana] 找到代币精度: ${token.symbol} = ${token.decimals}`);
          return token.decimals;
        }
      }
      
      // 默认精度 (SOL = 9, 大多数SPL代币 = 6)
      return upperSymbol === 'SOL' ? 9 : 6;
    } catch (error) {
      console.warn(`[Solana] 获取代币精度失败，使用默认值`);
      return 6; // 默认精度
    }
  }

  /**
   * 获取代币价格
   * @param tokenSymbol 代币符号
   * @param baseSymbol 基础代币符号，默认USDC
   * @returns 价格或null
   */
  public async getTokenPrice(tokenSymbol: string, baseSymbol: string = 'USDC'): Promise<number | null> {
    try {
      console.log(`[Solana] 获取价格: ${tokenSymbol}/${baseSymbol}`);
      
      // 获取代币地址
      const tokenAddress = await this.getTokenAddressBySymbol(tokenSymbol);
      if (!tokenAddress) {
        throw new Error(`未找到代币地址: ${tokenSymbol}`);
      }
      
      const baseAddress = await this.getTokenAddressBySymbol(baseSymbol);
      if (!baseAddress) {
        throw new Error(`未找到基础代币地址: ${baseSymbol}`);
      }
      
      console.log(`[Solana] 代币地址: ${tokenSymbol}=${tokenAddress}, ${baseSymbol}=${baseAddress}`);
      
      // 获取代币精度
      const tokenDecimals = await this.getTokenDecimals(tokenAddress);
      const baseDecimals = await this.getTokenDecimals(baseAddress);
      console.log(`[Solana] 代币精度: ${tokenSymbol}=${tokenDecimals}, ${baseSymbol}=${baseDecimals}`);
      
      // 首先尝试使用交易API获取价格（更可靠）
      try {
        console.log('[Solana] 尝试使用Jupiter交易API获取价格...');
        
        // 计算输入金额，使用代币精度
        const inputAmount = Math.pow(10, tokenDecimals);
        console.log(`[Solana] 输入金额: ${inputAmount} (1 ${tokenSymbol})`);
        
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
          // 获取原始金额
          const rawOutAmount = Number(quoteResponse.data.outAmount);
          const rawInAmount = Number(quoteResponse.data.inAmount);
          
          // 考虑精度转换为实际金额
          const outAmount = rawOutAmount / Math.pow(10, baseDecimals);
          const inAmount = rawInAmount / Math.pow(10, tokenDecimals);
          
          console.log(`[Solana] 原始输出金额: ${rawOutAmount}, 精度调整后: ${outAmount}`);
          console.log(`[Solana] 原始输入金额: ${rawInAmount}, 精度调整后: ${inAmount}`);
          
          if (outAmount > 0 && inAmount > 0) {
            // 计算价格 (输出金额/输入金额)
            const price = outAmount / inAmount;
            
            // 验证价格
            if (this.isValidPrice(price, tokenSymbol, baseSymbol)) {
              console.log(`[Solana] ${tokenSymbol}/${baseSymbol} 价格 (通过Jupiter): ${price}`);
              return price;
            } else {
              console.warn(`[Solana] 获取的价格异常: ${price}, 尝试其他方法`);
            }
          }
        }
      } catch (error: any) {
        console.error('[Solana] 使用Jupiter API获取价格失败:', error.message);
        console.log('[Solana] 尝试使用价格API...');
      }
      
      // 如果交易API失败，尝试使用价格API
      try {
        const response = await axios.get(API_CONFIG.JUPITER_PRICE_API, {
          params: {
            ids: tokenAddress,
            vsTokens: baseAddress
          },
          timeout: 5000 // 5秒超时
        });
        
        if (response.data && 
            response.data.data && 
            response.data.data[tokenAddress] && 
            response.data.data[tokenAddress][baseAddress]) {
          const price = response.data.data[tokenAddress][baseAddress];
          
          // 验证价格
          if (this.isValidPrice(price, tokenSymbol, baseSymbol)) {
            console.log(`[Solana] ${tokenSymbol}/${baseSymbol} 价格 (通过价格API): ${price}`);
            return price;
          } else {
            console.warn(`[Solana] 获取的价格异常: ${price}, 尝试其他方法`);
          }
        }
      } catch (error) {
        console.log('[Solana] 使用地址获取价格失败，尝试使用符号...');
      }
      
      // 最后尝试使用符号
      try {
        const response = await axios.get(API_CONFIG.JUPITER_PRICE_API, {
          params: {
            ids: tokenSymbol,
            vsToken: baseSymbol
          },
          timeout: 5000 // 5秒超时
        });
        
        if (response.data && 
            response.data.data && 
            response.data.data[tokenSymbol] && 
            response.data.data[tokenSymbol].price) {
          const price = response.data.data[tokenSymbol].price;
          
          // 验证价格
          if (this.isValidPrice(price, tokenSymbol, baseSymbol)) {
            console.log(`[Solana] ${tokenSymbol}/${baseSymbol} 价格 (通过符号): ${price}`);
            return price;
          } else {
            console.warn(`[Solana] 获取的价格异常: ${price}, 跳过`);
          }
        }
      } catch (error) {
        console.log('[Solana] 使用符号获取价格失败');
      }
      
      console.log(`[Solana] 未找到 ${tokenSymbol}/${baseSymbol} 价格`);
      return null;
    } catch (error: any) {
      console.error(`[Solana] 获取价格失败:`, error.message);
      return null;
    }
  }

  /**
   * 验证价格是否在合理范围内
   * @param price 价格
   * @param tokenSymbol 代币符号
   * @param baseSymbol 基础代币符号
   * @returns 价格是否合理
   */
  private isValidPrice(price: number, tokenSymbol: string, baseSymbol: string): boolean {
    // 一些基本验证
    if (!price || price <= 0 || isNaN(price)) {
      return false;
    }
    
    const upperToken = tokenSymbol.toUpperCase();
    const upperBase = baseSymbol.toUpperCase();
    
    // SOL/USDC 特殊处理
    if (upperToken === 'SOL' && (upperBase === 'USDC' || upperBase === 'USDT')) {
      // SOL价格通常在10-500之间
      if (price < 10 || price > 500) {
        console.warn(`[Solana] SOL价格超出合理范围: ${price}`);
        return false;
      }
    }
    
    // 价格不应该过高
    if (price > 1000000) {
      console.warn(`[Solana] 价格异常高: ${price}`);
      return false;
    }
    
    return true;
  }

  /**
   * 搜索代币
   * @param query 搜索关键词
   * @returns 匹配的代币列表
   */
  public async searchToken(query: string): Promise<Array<any>> {
    try {
      console.log(`[Solana] 搜索代币: ${query}`);
      
      const response = await axios.get(API_CONFIG.JUPITER_TOKEN_LIST_API);
      
      if (!response.data || !Array.isArray(response.data)) {
        console.error('[Solana] 获取代币列表失败: 无效响应');
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
        console.log(`[Solana] 找到 ${matchingTokens.length} 个匹配的代币`);
        
        // 对结果添加价格信息
        const tokensWithPrice = await Promise.all(matchingTokens.map(async (token) => {
          try {
            const price = await this.getTokenPrice(token.symbol);
            return {
              ...token,
              price: price || null
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
        console.log(`[Solana] 未找到匹配的代币: ${query}`);
        return [];
      }
    } catch (error: any) {
      console.error('[Solana] 搜索代币失败:', error.message);
      return [];
    }
  }
}

// 导出单例实例
export const solanaPriceService = new SolanaPriceService();

export default solanaPriceService; 