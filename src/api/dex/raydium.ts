import axios from 'axios';
import { config } from '../../config';
import { resolveToken } from '../../services/tokenResolver';
import { getTokenBySymbol } from '../../config/tokens';
import { getCexTokenPrice } from '../../services/price';
import { Connection, clusterApiUrl } from '@solana/web3.js';

/**
 * Raydium DEX API接口
 */
export class RaydiumAPI {
  private apiUrl: string;
  private solanaConnection: Connection;
  private tokenAddressCache: Map<string, string> = new Map(); // 添加缓存
  
  constructor() {
    this.apiUrl = config.RAYDIUM_API_URL;
    this.solanaConnection = new Connection(clusterApiUrl('mainnet-beta'));
    // 确保API URL是有效的，如果配置有问题则使用默认URL
    if (!this.apiUrl || this.apiUrl.endsWith('/v2')) {
      console.log('[Raydium] 检测到无效的API URL，使用默认API URL');
      this.apiUrl = 'https://api.raydium.io/v2/main/pairs';
      
      // 如果默认URL也不可用，尝试使用其他已知的Raydium API端点
      axios.get(this.apiUrl, { timeout: 5000 })
        .catch(() => {
          console.log('[Raydium] 默认API URL不可用，尝试其他API端点');
          this.apiUrl = 'https://api.raydium.io/info/pairs';
        });
    }
  }
  
  /**
   * 获取代币价格
   * @param tokenSymbol 代币符号
   * @param baseTokenSymbol 基础代币符号
   * @returns 代币价格
   */
  async getTokenPrice(tokenSymbol: string, baseTokenSymbol: string): Promise<string | null> {
    try {
      console.log(`[Raydium] 正在查询 ${tokenSymbol}/${baseTokenSymbol} 价格...`);
      
      // 处理SOL/WSOL转换
      const normalizedTokenSymbol = this.normalizeTokenSymbol(tokenSymbol);
      const normalizedBaseSymbol = this.normalizeTokenSymbol(baseTokenSymbol);
      
      console.log(`[Raydium] 规范化后的代币符号: ${normalizedTokenSymbol}/${normalizedBaseSymbol}`);
      
      // 1. 首先尝试通过Jupiter API直接获取价格
      try {
        const jupiterPrice = await this.getJupiterPrice(normalizedTokenSymbol, normalizedBaseSymbol);
        if (jupiterPrice) {
          return jupiterPrice.toString();
        }
      } catch (jupiterError) {
        console.log(`[Raydium] Jupiter API获取价格失败: ${(jupiterError as Error).message}`);
      }
      
      // 2. 如果Jupiter API失败，尝试通过Raydium API获取
      const actualTokenSymbol = normalizedTokenSymbol.toUpperCase();
      const actualBaseTokenSymbol = normalizedBaseSymbol.toUpperCase();
      
      try {
        // 获取代币信息
        const token = await resolveToken(actualTokenSymbol);
        const baseToken = await resolveToken(actualBaseTokenSymbol);
        
        if (!token) {
          throw new Error(`未找到代币: ${actualTokenSymbol}`);
        }
        
        if (!baseToken) {
          throw new Error(`未找到基础代币: ${actualBaseTokenSymbol}`);
        }
        
        // 确保地址存在
        if (!token.address) {
          throw new Error(`代币 ${actualTokenSymbol} 没有有效的地址`);
        }
        
        if (!baseToken.address) {
          throw new Error(`基础代币 ${actualBaseTokenSymbol} 没有有效的地址`);
        }
        
        console.log(`[Raydium] 代币信息: ${token.symbol} (${token.name}) - ${token.address}`);
        console.log(`[Raydium] 基础代币信息: ${baseToken.symbol} (${baseToken.name}) - ${baseToken.address}`);
        
        // 尝试从Raydium获取价格
        try {
          // 获取交易对
          const pairs = await this.getPairs();
          const pair = this.findPair(pairs, token.address, baseToken.address);
          
          if (pair) {
            return pair.price;
          }
          
          // 如果在Raydium上没找到交易对，尝试从Solana公共API获取价格
          const solanaPrice = await this.getSolanaTokenPrice(token.address, baseToken.address);
          if (solanaPrice) {
            return solanaPrice.toString();
          }
          throw new Error(`Raydium上未找到交易对: ${actualTokenSymbol}/${actualBaseTokenSymbol}`);
        } catch (error) {
          console.error(`[Raydium] 获取代币价格失败:`, error);
          throw new Error(`获取Raydium代币价格失败: ${(error as Error).message}`);
        }
      } catch (error) {
        console.error(`[Raydium] 获取价格失败:`, error);
        throw error;
      }
    } catch (error) {
      console.error(`[Raydium] 获取价格失败:`, error);
      throw error;
    }
  }
  
  /**
   * 规范化代币符号，处理SOL/WSOL转换
   * @param symbol 原始代币符号
   * @returns 规范化后的代币符号
   */
  private normalizeTokenSymbol(symbol: string): string {
    const upperSymbol = symbol.toUpperCase();
    
    // SOL在Solana链上使用WSOL
    if (upperSymbol === 'SOL') {
      console.log(`[Raydium] 将SOL转换为WSOL`);
      return 'WSOL';
    }
    
    return symbol;
  }
  
  /**
   * 直接从Jupiter API获取价格
   */
  private async getJupiterPrice(tokenSymbol: string, baseTokenSymbol: string): Promise<number | null> {
    try {
      // 处理SOL/WSOL转换
      const normalizedTokenSymbol = this.normalizeTokenSymbol(tokenSymbol);
      const normalizedBaseSymbol = this.normalizeTokenSymbol(baseTokenSymbol);
      
      // 获取代币地址
      const tokenAddress = await this.getTokenAddress(normalizedTokenSymbol);
      const baseTokenAddress = await this.getTokenAddress(normalizedBaseSymbol);
      
      if (!tokenAddress || !baseTokenAddress) {
        console.log(`[Raydium] 未找到代币地址: ${normalizedTokenSymbol} 或 ${normalizedBaseSymbol}`);
        return null;
      }
      
      console.log(`[Raydium] 代币地址: ${tokenAddress}`);
      console.log(`[Raydium] 基础代币地址: ${baseTokenAddress}`);
      
      // 使用Jupiter Price API
      const jupiterPriceUrl = `${config.JUPITER_API_URL}/price?inputMint=${tokenAddress}&outputMint=${baseTokenAddress}&amount=1000000000&slippage=0.5`;
      console.log(`[Raydium] Jupiter Price API URL: ${jupiterPriceUrl}`);
      
      const response = await axios.get(jupiterPriceUrl);
      
      if (response.data && response.data.data && response.data.data.price) {
        console.log(`[Raydium] Jupiter Price API 返回价格: ${response.data.data.price}`);
        return parseFloat(response.data.data.price);
      } else if (response.data && response.data.price) {
        console.log(`[Raydium] Jupiter Price API 返回价格: ${response.data.price}`);
        return parseFloat(response.data.price);
      }
      
      console.log(`[Raydium] Jupiter Price API 响应: ${JSON.stringify(response.data)}`);
      return null;
    } catch (error) {
      console.error(`[Raydium] 从Jupiter Price API获取价格失败:`, error);
      return null;
    }
  }
  
  /**
   * 从Jupiter API获取Solana代币价格
   */
  private async getSolanaTokenPrice(tokenSymbol: string, baseTokenSymbol: string): Promise<number | null> {
    try {
      // 处理SOL/WSOL转换
      const normalizedTokenSymbol = this.normalizeTokenSymbol(tokenSymbol);
      const normalizedBaseSymbol = this.normalizeTokenSymbol(baseTokenSymbol);
      
      // 获取代币地址
      const tokenAddress = await this.getTokenAddress(normalizedTokenSymbol);
      const baseTokenAddress = await this.getTokenAddress(normalizedBaseSymbol);
      
      if (!tokenAddress || !baseTokenAddress) {
        console.log(`[Raydium] 未找到代币地址: ${normalizedTokenSymbol} 或 ${normalizedBaseSymbol}`);
        return null;
      }
      
      console.log(`[Raydium] 代币地址: ${tokenAddress}`);
      console.log(`[Raydium] 基础代币地址: ${baseTokenAddress}`);
      
      // 使用更可靠的Jupiter聚合器API
      const jupiterPriceUrl = `${config.JUPITER_API_URL}/price?inputMint=${tokenAddress}&outputMint=${baseTokenAddress}&amount=1000000000&slippage=0.5`;
      console.log(`[Raydium] Jupiter API URL: ${jupiterPriceUrl}`);
      
      const response = await axios.get(jupiterPriceUrl);
      
      if (response.data && response.data.data && response.data.data.price) {
        return parseFloat(response.data.data.price);
      } else if (response.data && response.data.price) {
        return parseFloat(response.data.price);
      }
      
      console.log(`[Raydium] Jupiter API响应: ${JSON.stringify(response.data)}`);
      return null;
    } catch (error) {
      console.error(`[Raydium] 从Jupiter API获取价格失败:`, error);
      return null;
    }
  }
  
  /**
   * 获取流动性池信息
   * @param tokenASymbol 代币A符号
   * @param tokenBSymbol 代币B符号
   */
  async getPoolInfo(tokenASymbol: string, tokenBSymbol: string): Promise<any> {
    try {
      // 获取代币信息
      const tokenA = getTokenBySymbol(tokenASymbol, 'solana');
      const tokenB = getTokenBySymbol(tokenBSymbol, 'solana');
      
      if (!tokenA || !tokenB) {
        throw new Error(`代币信息不存在: ${!tokenA ? tokenASymbol : tokenBSymbol}`);
      }
      
      // 请求Raydium API获取池子信息
      const response = await axios.get(this.apiUrl);
      const pools = response.data;
      
      // 查找匹配的流动性池
      const pool = pools.find((p: any) => 
        (p.baseMint === tokenA.address && p.quoteMint === tokenB.address) || 
        (p.baseMint === tokenB.address && p.quoteMint === tokenA.address)
      );
      
      if (!pool) {
        throw new Error(`Raydium上未找到流动性池: ${tokenASymbol}/${tokenBSymbol}`);
      }
      
      // 格式化返回数据
      return {
        id: pool.id,
        name: `${tokenASymbol}-${tokenBSymbol}`,
        tokenA: {
          symbol: tokenASymbol,
          decimals: tokenA.decimals,
          reserve: pool.baseReserve
        },
        tokenB: {
          symbol: tokenBSymbol,
          decimals: tokenB.decimals,
          reserve: pool.quoteReserve
        },
        fee: pool.fee,
        tvl: pool.liquidity,
        volume24h: pool.volume24h || '0',
        apy: pool.apy || '0'
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取Raydium流动池信息失败: ${err.message}`);
    }
  }
  
  /**
   * 模拟交易
   * @param fromTokenSymbol 卖出代币符号
   * @param toTokenSymbol 买入代币符号
   * @param amount 卖出金额
   */
  async simulateSwap(fromTokenSymbol: string, toTokenSymbol: string, amount: string): Promise<{
    fromAmount: string;
    toAmount: string;
    price: string;
    priceImpact: string;
    fee: string;
  }> {
    try {
      // 获取代币信息
      const fromToken = getTokenBySymbol(fromTokenSymbol, 'solana');
      const toToken = getTokenBySymbol(toTokenSymbol, 'solana');
      
      if (!fromToken || !toToken) {
        throw new Error(`代币信息不存在: ${!fromToken ? fromTokenSymbol : toTokenSymbol}`);
      }
      
      // 获取池子信息
      const pool = await this.getPoolInfo(fromTokenSymbol, toTokenSymbol);
      
      // 交易模拟逻辑
      // 实现基于恒定乘积公式 x * y = k
      const amountIn = parseFloat(amount);
      const reserveIn = parseFloat(pool.tokenA.symbol === fromTokenSymbol ? 
        pool.tokenA.reserve : pool.tokenB.reserve);
      const reserveOut = parseFloat(pool.tokenA.symbol === fromTokenSymbol ? 
        pool.tokenB.reserve : pool.tokenA.reserve);
      
      // 计算手续费
      const feePct = parseFloat(pool.fee || "0.003");  // 默认0.3%手续费
      const feeAmount = amountIn * feePct;
      
      // 计算输出金额，考虑手续费: (reserveOut * amountIn * (1-fee)) / (reserveIn + amountIn * (1-fee))
      const amountInWithFee = amountIn * (1 - feePct);
      const numerator = reserveOut * amountInWithFee;
      const denominator = reserveIn + amountInWithFee;
      const amountOut = numerator / denominator;
      
      // 计算价格影响
      // 价格影响 = (现在价格 - 执行前价格) / 执行前价格 * 100%
      const spotPriceBefore = reserveOut / reserveIn;
      const spotPriceAfter = (reserveOut - amountOut) / (reserveIn + amountInWithFee);
      const priceImpact = Math.abs((spotPriceAfter - spotPriceBefore) / spotPriceBefore) * 100;
      
      return {
        fromAmount: amount,
        toAmount: amountOut.toString(),
        price: (amountOut / amountIn).toString(),
        priceImpact: priceImpact.toFixed(2),
        fee: feeAmount.toString()
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`模拟Raydium交易失败: ${err.message}`);
    }
  }
  
  /**
   * 获取代币地址
   * @param symbol 代币符号
   * @returns 代币地址
   */
  private async getTokenAddress(symbol: string): Promise<string | null> {
    // 规范化代币符号，处理SOL/WSOL转换
    const normalizedSymbol = this.normalizeTokenSymbol(symbol);
    const upperSymbol = normalizedSymbol.toUpperCase();
    
    // 检查缓存
    if (this.tokenAddressCache.has(upperSymbol)) {
      const cachedAddress = this.tokenAddressCache.get(upperSymbol);
      console.log(`[Raydium] 从缓存获取地址: ${upperSymbol} -> ${cachedAddress}`);
      return cachedAddress as string;
    }
    
    // 1. 首先检查常用代币的缓存
    const commonTokens: Record<string, string> = {
      'SOL': 'So11111111111111111111111111111111111111112', // 原生SOL
      'WSOL': 'So11111111111111111111111111111111111111112', // 包装SOL
      'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC (Solana)
      'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT (Solana)
    };
    
    if (commonTokens[upperSymbol]) {
      const address = commonTokens[upperSymbol];
      console.log(`[Raydium] 从常用代币列表获取地址: ${upperSymbol} -> ${address}`);
      // 添加到缓存
      this.tokenAddressCache.set(upperSymbol, address);
      return address;
    }
    
    // 2. 如果是native，返回SOL地址
    if (upperSymbol === 'NATIVE') {
      const address = commonTokens['SOL'];
      this.tokenAddressCache.set(upperSymbol, address);
      return address;
    }
    
    try {
      let foundAddress: string | null = null;
      
      // 3. 尝试从Solana代币列表获取
      if (!foundAddress) {
        console.log(`[Raydium] 尝试从Solana代币列表获取 ${symbol} 地址...`);
        try {
          const response = await axios.get(config.SOLANA_TOKEN_LIST_URL);
          
          if (response.data && response.data.tokens) {
            const token = response.data.tokens.find((t: any) => 
              t.symbol.toUpperCase() === upperSymbol || 
              t.name.toUpperCase().includes(upperSymbol)
            );
            
            if (token) {
              console.log(`[Raydium] 从Solana代币列表找到: ${token.symbol} (${token.name}) -> ${token.address}`);
              foundAddress = token.address;
            }
          }
        } catch (error) {
          console.error(`[Raydium] 从Solana代币列表获取地址失败:`, error);
        }
      }
      
      // 4. 尝试从Jupiter API获取
      if (!foundAddress) {
        console.log(`[Raydium] 尝试从Jupiter API获取 ${symbol} 地址...`);
        try {
          const jupiterResponse = await axios.get(config.JUPITER_TOKEN_LIST_URL);
          
          if (jupiterResponse.data) {
            const jupToken = jupiterResponse.data.find((t: any) => 
              t.symbol.toUpperCase() === upperSymbol || 
              t.name.toUpperCase().includes(upperSymbol)
            );
            
            if (jupToken) {
              console.log(`[Raydium] 从Jupiter API找到: ${jupToken.symbol} (${jupToken.name}) -> ${jupToken.address}`);
              foundAddress = jupToken.address;
            }
          }
        } catch (error) {
          console.error(`[Raydium] 从Jupiter API获取地址失败:`, error);
        }
      }
      
      // 5. 尝试使用CoinGecko获取代币信息
      if (!foundAddress) {
        console.log(`[Raydium] 尝试从CoinGecko获取 ${symbol} 信息...`);
        try {
          const searchUrl = `${config.COINGECKO_API_URL}/search?query=${symbol}`;
          const searchResponse = await axios.get(searchUrl);
          
          if (searchResponse.data && searchResponse.data.coins && searchResponse.data.coins.length > 0) {
            // 尝试找到最匹配的代币
            const exactSymbolMatch = searchResponse.data.coins.find(
              (coin: any) => coin.symbol.toLowerCase() === symbol.toLowerCase()
            );
            
            const bestMatch = exactSymbolMatch || searchResponse.data.coins[0];
            console.log(`[Raydium] 从CoinGecko找到: ${bestMatch.symbol} (${bestMatch.name})`);
            
            // 由于CoinGecko不直接提供Solana地址，我们需要使用代币符号再次查询Solana代币列表
            if (bestMatch.symbol) {
              const symbolToSearch = bestMatch.symbol.toUpperCase();
              
              try {
                // 重新查询Solana代币列表
                const response = await axios.get(config.SOLANA_TOKEN_LIST_URL);
                
                if (response.data && response.data.tokens) {
                  const tokenBySymbol = response.data.tokens.find((t: any) => 
                    t.symbol.toUpperCase() === symbolToSearch
                  );
                  
                  if (tokenBySymbol) {
                    console.log(`[Raydium] 通过CoinGecko符号在Solana列表找到: ${tokenBySymbol.address}`);
                    foundAddress = tokenBySymbol.address;
                  }
                }
              } catch (error) {
                console.error(`[Raydium] 通过CoinGecko符号查询Solana列表失败:`, error);
              }
            }
          }
        } catch (error) {
          console.error(`[Raydium] 从CoinGecko获取信息失败:`, error);
        }
      }
      
      // 如果找到了地址，添加到缓存
      if (foundAddress) {
        this.tokenAddressCache.set(upperSymbol, foundAddress);
        return foundAddress;
      }
      
      console.log(`[Raydium] 未找到代币地址: ${symbol}`);
      return null;
    } catch (error) {
      console.error(`[Raydium] 获取代币地址失败:`, error);
      return null;
    }
  }
  
  /**
   * 获取Raydium交易对列表
   */
  private async getPairs(): Promise<any[]> {
    try {
      // 确保API URL是否配置
      if (!this.apiUrl) {
        throw new Error('未配置Raydium API URL');
      }
      
      console.log(`[Raydium] API URL: ${this.apiUrl}`);
      
      // 请求Raydium API获取价格信息
      const response = await axios.get(`${this.apiUrl}/pairs`, {
        timeout: 15000
      });
      
      // 检查API返回结果
      if (!response.data) {
        throw new Error('Raydium API返回数据为空');
      }
      
      if (!Array.isArray(response.data)) {
        console.log(`[Raydium] API返回非数组数据:`, JSON.stringify(response.data, null, 2));
        throw new Error('Raydium API返回数据格式不正确: ' + typeof response.data);
      }
      
      console.log(`[Raydium] 找到 ${response.data.length} 个池子`);
      return response.data;
    } catch (error) {
      console.error(`[Raydium] 获取交易对失败:`, error);
      return [];
    }
  }
  
  /**
   * 查找匹配的交易对
   */
  private findPair(pairs: any[], tokenAddress: string, baseTokenAddress: string): any | null {
    // 查找匹配的交易对
    const pair = pairs.find((p: any) => 
      (p.baseMint === tokenAddress && p.quoteMint === baseTokenAddress) || 
      (p.baseMint === baseTokenAddress && p.quoteMint === tokenAddress)
    );
    
    if (!pair) {
      console.log(`[Raydium] 未找到交易对 ${tokenAddress}/${baseTokenAddress}`);
      return null;
    }
    
    // 打印交易对信息
    console.log(`[Raydium] 找到交易对:`, JSON.stringify(pair, null, 2));
    
    // 计算价格
    let price: string;
    if (pair.baseMint === tokenAddress) {
      price = (1 / parseFloat(pair.price)).toString();
    } else {
      price = pair.price;
    }
    
    console.log(`[Raydium] 价格: ${price}`);
    return { ...pair, price };
  }
}

export default new RaydiumAPI(); 