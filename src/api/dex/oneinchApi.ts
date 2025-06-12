import { API_CONFIG } from '../../config/env';
import { IDexApi, PriceResult, ExchangeType, BlockchainType } from '../interfaces/exchangeApi';
import HttpClient from '../../utils/http/httpClient';

/**
 * 1inch API实现
 */
class OneInchApi implements IDexApi {
  public readonly http: HttpClient;
  public readonly apiUrl: string;
  
  // 1inch支持的链ID
  public readonly chainIds = {
    ethereum: 1,
    bsc: 56,
    polygon: 137,
    optimism: 10,
    arbitrum: 42161,
    avalanche: 43114,
    gnosis: 100,
    fantom: 250,
    klaytn: 8217,
    aurora: 1313161554,
    zksync: 324
  };
  
  // 常见代币地址映射
  public readonly tokenAddresses: Record<string, Record<string, string>> = {
    ethereum: {
      'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      'USDT': '0xdac17f958d2ee523a2206206994597c13d831ec7',
      'USDC': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'DAI': '0x6b175474e89094c44da98b954eedeac495271d0f',
      'WBTC': '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'
    },
    bsc: {
      'BNB': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      'BUSD': '0xe9e7cea3dedca5984780bafc599bd69add087d56',
      'USDT': '0x55d398326f99059ff775485246999027b3197955',
      'USDC': '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
    }
  };
  
  constructor() {
    this.apiUrl = API_CONFIG.ONEINCH_API || 'https://api.1inch.io/v5.0';
    this.http = HttpClient.create(this.apiUrl);
  }
  
  /**
   * 获取交易所名称
   */
  public getName(): string {
    return '1inch';
  }
  
  /**
   * 获取交易所类型
   */
  public getType(): ExchangeType {
    return ExchangeType.DEX;
  }
  
  /**
   * 获取区块链类型
   */
  public getBlockchain(): BlockchainType {
    return BlockchainType.MULTI;
  }
  
  /**
   * 获取代币地址
   * @param symbol 代币符号
   * @param chain 区块链 (默认ethereum)
   * @returns 代币地址
   */
  public async getTokenAddress(
    symbol: string,
    chain: keyof typeof this.chainIds = 'ethereum'
  ): Promise<string | null> {
    try {
      const chainId = this.chainIds[chain];
      if (!chainId) return null;
      
      const normalizedSymbol = symbol.toUpperCase();
      
      // 检查预设的代币地址
      if (this.tokenAddresses[chain]?.[normalizedSymbol]) {
        return this.tokenAddresses[chain][normalizedSymbol];
      }
      
      // 尝试获取代币列表
      const response = await this.http.get(`/${chainId}/tokens`);
      if (response.data && response.data.tokens) {
        // 在代币列表中查找
        const token = Object.values(response.data.tokens).find(
          (t: any) => t.symbol.toUpperCase() === normalizedSymbol
        ) as any;
        
        if (token && token.address) {
          return token.address;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`[1inch] 获取代币地址失败:`, error);
      return null;
    }
  }
  
  /**
   * 获取代币价格
   * @param tokenSymbol 代币符号
   * @param baseTokenSymbol 基础代币符号
   * @param chain 区块链 (默认ethereum)
   * @returns 代币价格结果
   */
  public async getTokenPrice(
    tokenSymbol: string, 
    baseTokenSymbol: string = 'USDT',
    chain: keyof typeof this.chainIds = 'ethereum'
  ): Promise<PriceResult> {
    try {
      console.log(`[1inch] 获取 ${tokenSymbol}/${baseTokenSymbol} 价格 (${chain})...`);
      
      // 获取链ID
      const chainId = this.chainIds[chain];
      if (!chainId) {
        return {
          exchange: this.getName(),
          exchangeType: this.getType(),
          blockchain: BlockchainType.MULTI,
          success: false,
          error: `不支持的区块链: ${chain}`
        };
      }
      
      // 规范化代币符号
      const normalizedTokenSymbol = tokenSymbol.toUpperCase();
      const normalizedBaseTokenSymbol = baseTokenSymbol.toUpperCase();
      
      // 获取代币地址
      const fromTokenAddress = await this.getTokenAddress(normalizedTokenSymbol, chain);
      const toTokenAddress = await this.getTokenAddress(normalizedBaseTokenSymbol, chain);
      
      if (!fromTokenAddress) {
        return {
          exchange: this.getName(),
          exchangeType: this.getType(),
          blockchain: BlockchainType.MULTI,
          success: false,
          error: `未找到代币地址: ${normalizedTokenSymbol}`
        };
      }
      
      if (!toTokenAddress) {
        return {
          exchange: this.getName(),
          exchangeType: this.getType(),
          blockchain: BlockchainType.MULTI,
          success: false,
          error: `未找到代币地址: ${normalizedBaseTokenSymbol}`
        };
      }
      
      // 使用1inch API获取报价
      const amount = '1000000000000000000'; // 1 token (18 decimals)
      const url = `/${chainId}/quote?fromTokenAddress=${fromTokenAddress}&toTokenAddress=${toTokenAddress}&amount=${amount}`;
      
      const response = await this.http.get(url);
      
      if (response.data && response.data.toTokenAmount && response.data.fromTokenAmount) {
        // 计算价格
        const fromAmount = parseFloat(response.data.fromTokenAmount) / Math.pow(10, response.data.fromToken.decimals);
        const toAmount = parseFloat(response.data.toTokenAmount) / Math.pow(10, response.data.toToken.decimals);
        const price = toAmount / fromAmount;
        
        return {
          exchange: this.getName(),
          exchangeType: this.getType(),
          blockchain: BlockchainType.MULTI,
          success: true,
          price: price,
          timestamp: Date.now()
        };
      }
      
      return {
        exchange: this.getName(),
        exchangeType: this.getType(),
        blockchain: BlockchainType.MULTI,
        success: false,
        error: '未找到价格'
      };
    } catch (error) {
      const err = error as Error;
      console.error(`[1inch] 获取价格失败:`, err.message);
      return {
        exchange: this.getName(),
        exchangeType: this.getType(),
        blockchain: BlockchainType.MULTI,
        success: false,
        error: err.message
      };
    }
  }
  
  /**
   * 检查代币是否支持
   * @param tokenSymbol 代币符号
   * @param chain 区块链 (默认ethereum)
   * @returns 是否支持
   */
  public async isTokenSupported(
    tokenSymbol: string,
    chain: keyof typeof this.chainIds = 'ethereum'
  ): Promise<boolean> {
    try {
      const chainId = this.chainIds[chain];
      if (!chainId) return false;
      
      // 检查预设的代币地址
      const normalizedSymbol = tokenSymbol.toUpperCase();
      if (this.tokenAddresses[chain]?.[normalizedSymbol]) {
        return true;
      }
      
      // 尝试获取代币列表
      const response = await this.http.get(`/${chainId}/tokens`);
      if (response.data && response.data.tokens) {
        // 在代币列表中查找
        return Object.values(response.data.tokens).some(
          (token: any) => token.symbol.toUpperCase() === normalizedSymbol
        );
      }
      
      return false;
    } catch (error) {
      console.error(`[1inch] 检查代币支持失败:`, error);
      return false;
    }
  }
}

// 创建单例实例
const oneInchApi = new OneInchApi();
export default oneInchApi; 