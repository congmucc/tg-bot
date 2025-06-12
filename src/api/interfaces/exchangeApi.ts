/**
 * 交易所类型枚举
 */
export enum ExchangeType {
  // 中心化交易所
  CEX = 'centralized',
  
  // 去中心化交易所
  DEX = 'decentralized',
  
  // 聚合器
  AGGREGATOR = 'aggregator'
}

/**
 * 区块链类型枚举
 */
export enum BlockchainType {
  ETHEREUM = 'ethereum',
  SOLANA = 'solana',
  BSC = 'bsc',
  POLYGON = 'polygon',
  AVALANCHE = 'avalanche',
  MULTI = 'multi-chain', // 多链支持
  UNKNOWN = 'unknown'
}

/**
 * 价格结果接口
 */
export interface PriceResult {
  exchange: string;        // 交易所名称
  exchangeType: ExchangeType; // 交易所类型
  blockchain?: BlockchainType; // 区块链类型 (对于DEX)
  success: boolean;        // 是否成功
  price?: number;          // 价格
  error?: string;          // 错误信息
  timestamp?: number;      // 时间戳
  isOutlier?: boolean;     // 是否异常值
}

/**
 * 交易所API基础接口
 * 所有交易所API实现都应该继承这个接口
 */
export interface IExchangeApi {
  /**
   * 获取交易所名称
   */
  getName(): string;
  
  /**
   * 获取交易所类型
   */
  getType(): ExchangeType;
  
  /**
   * 获取区块链类型 (仅对DEX有效)
   */
  getBlockchain?(): BlockchainType;
  
  /**
   * 获取代币价格
   * @param tokenSymbol 代币符号
   * @param baseTokenSymbol 基础代币符号 (通常是USDT/USDC等)
   * @returns 价格结果
   */
  getTokenPrice(tokenSymbol: string, baseTokenSymbol: string): Promise<PriceResult>;
  
  /**
   * 检查代币是否支持
   * @param tokenSymbol 代币符号
   * @returns 是否支持
   */
  isTokenSupported?(tokenSymbol: string): Promise<boolean>;
}

/**
 * DEX API接口
 * 继承基础交易所API，添加DEX特有的方法
 */
export interface IDexApi extends IExchangeApi {
  /**
   * 获取区块链类型
   */
  getBlockchain(): BlockchainType;
  
  /**
   * 获取代币地址
   * @param symbol 代币符号
   * @returns 代币地址
   */
  getTokenAddress?(symbol: string): Promise<string | null>;
}

/**
 * CEX API接口
 * 继承基础交易所API，添加CEX特有的方法
 */
export interface ICexApi extends IExchangeApi {
  /**
   * 获取交易对
   * @param tokenSymbol 代币符号
   * @param baseTokenSymbol 基础代币符号
   * @returns 交易对符号
   */
  formatTradingPair?(tokenSymbol: string, baseTokenSymbol: string): string;
}

/**
 * 价格聚合器接口
 * 用于聚合多个交易所的价格
 */
export interface IPriceAggregator {
  /**
   * 获取聚合器名称
   */
  getName(): string;
  
  /**
   * 从多个交易所获取价格
   * @param tokenSymbol 代币符号
   * @param baseTokenSymbol 基础代币符号
   * @returns 各交易所价格结果
   */
  getPrices(tokenSymbol: string, baseTokenSymbol: string): Promise<PriceResult[]>;
  
  /**
   * 检测价格异常值
   * @param prices 价格结果数组
   * @returns 处理后的价格结果数组
   */
  detectOutliers(prices: PriceResult[]): PriceResult[];
  
  /**
   * 获取最佳价格
   * @param prices 价格结果数组
   * @returns 最佳价格结果
   */
  getBestPrice(prices: PriceResult[]): PriceResult | null;
  
  /**
   * 获取价格统计信息
   * @param prices 价格结果数组
   * @returns 价格统计信息
   */
  getPriceStats(prices: PriceResult[]): {
    lowest?: PriceResult;
    highest?: PriceResult;
    average?: number;
    median?: number;
    diff?: number;
  };
} 