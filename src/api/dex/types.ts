/**
 * DEX API接口定义
 */
export interface DexAPI {
  /**
   * 获取代币价格
   * @param tokenSymbol 代币符号
   * @param baseTokenSymbol 基础代币符号
   * @returns 价格字符串
   */
  getTokenPrice(tokenSymbol: string, baseTokenSymbol: string): Promise<string | null>;
} 