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
  
  // 常见代币地址映射 - 通用解决方案
  public readonly tokenAddresses: Record<string, Record<string, string>> = {
    ethereum: {
      'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      'BTC': '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
      'WBTC': '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      'USDT': '0xdac17f958d2ee523a2206206994597c13d831ec7',
      'USDC': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'DAI': '0x6b175474e89094c44da98b954eedeac495271d0f',
      'LINK': '0x514910771af9ca656af840dff83e8264ecf986ca',
      'UNI': '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
      'AAVE': '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
      'MATIC': '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
      'CRV': '0xd533a949740bb3306d119cc777fa900ba034cd52'
    },
    bsc: {
      'BNB': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      'BTC': '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c', // BTCB
      'BTCB': '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c',
      'ETH': '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
      'BUSD': '0xe9e7cea3dedca5984780bafc599bd69add087d56',
      'USDT': '0x55d398326f99059ff775485246999027b3197955',
      'USDC': '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      'CAKE': '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
      'ADA': '0x3ee2200efb3400fabb9aacf31297cbdd1d435d47'
    },
    polygon: {
      'MATIC': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      'BTC': '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6', // WBTC
      'WBTC': '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
      'ETH': '0x7ceb23fd6c492c4b8b4c3b0c4b3b4b3b4b3b4b3b',
      'USDT': '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
      'USDC': '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'
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
        console.log(`[1inch] 找到预设代币地址: ${normalizedSymbol} -> ${this.tokenAddresses[chain][normalizedSymbol]}`);
        return this.tokenAddresses[chain][normalizedSymbol];
      }

      console.log(`[1inch] 未找到预设代币地址: ${normalizedSymbol} (chain: ${chain})`);
      console.log(`[1inch] 可用的预设代币:`, Object.keys(this.tokenAddresses[chain] || {}));
      
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

      console.log(`[1inch] 请求URL: ${url}`);
      console.log(`[1inch] 代币地址: ${normalizedTokenSymbol}=${fromTokenAddress}, ${normalizedBaseTokenSymbol}=${toTokenAddress}`);

      const response = await this.http.get(url, { timeout: 60000 });

      console.log(`[1inch] 响应状态: ${response.status}`);
      console.log(`[1inch] 响应数据:`, JSON.stringify(response.data, null, 2));

      if (response.data && response.data.toTokenAmount) {
        // 简化价格计算，直接使用返回的数据
        const fromAmount = parseFloat(amount); // 1 ETH = 1e18
        const toAmount = parseFloat(response.data.toTokenAmount);

        // 计算价格 (考虑精度差异)
        const price = toAmount / fromAmount * Math.pow(10, 12); // ETH(18位) -> USDC(6位) 需要调整12位

        console.log(`✅ [1inch] 成功获取价格: ${price} (原始: ${toAmount}/${fromAmount})`);

        return {
          exchange: this.getName(),
          exchangeType: this.getType(),
          blockchain: BlockchainType.MULTI,
          success: true,
          price: price,
          timestamp: Date.now()
        };
      }

      console.log(`❌ [1inch] 响应格式不正确或未找到价格数据`);
      return {
        exchange: this.getName(),
        exchangeType: this.getType(),
        blockchain: BlockchainType.MULTI,
        success: false,
        error: '未找到价格数据'
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