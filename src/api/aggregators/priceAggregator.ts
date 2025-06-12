import { IPriceAggregator, PriceResult } from '../interfaces/exchangeApi';
import binanceApi from '../cex/binanceApi';
import okxApi from '../cex/okxApi';
import coinbaseApi from '../cex/coinbaseApi';
import krakenApi from '../cex/krakenApi';
import huobiApi from '../cex/huobiApi';

/**
 * 价格聚合器实现
 * 从多个交易所获取价格并提供聚合功能
 */
class PriceAggregator implements IPriceAggregator {
  // 交易所API列表
  public exchangeApis = [
    binanceApi,
    okxApi,
    coinbaseApi,
    krakenApi,
    huobiApi
  ];
  
  /**
   * 获取聚合器名称
   */
  public getName(): string {
    return 'price-aggregator';
  }
  
  /**
   * 从多个交易所获取价格
   * @param tokenSymbol 代币符号
   * @param baseTokenSymbol 基础代币符号
   * @returns 各交易所价格结果
   */
  public async getPrices(tokenSymbol: string, baseTokenSymbol: string): Promise<PriceResult[]> {
    console.log(`[PriceAggregator] 获取 ${tokenSymbol}/${baseTokenSymbol} 价格从多个交易所...`);
    
    const pricePromises = this.exchangeApis.map(api => 
      api.getTokenPrice(tokenSymbol, baseTokenSymbol)
        .catch(error => {
          console.error(`[PriceAggregator] 从 ${api.getName()} 获取价格失败:`, error);
          return {
            exchange: api.getName(),
            exchangeType: api.getType(),
            success: false,
            error: error.message || '未知错误'
          } as PriceResult;
        })
    );
    
    // 等待所有价格请求完成
    const results = await Promise.all(pricePromises);
    
    // 过滤出成功的结果
    const successfulResults = results.filter(result => result.success && result.price !== undefined);
    
    console.log(`[PriceAggregator] 成功获取到 ${successfulResults.length} 个价格结果`);
    
    // 检测异常值
    return this.detectOutliers(results);
  }
  
  /**
   * 检测价格异常值
   * @param prices 价格结果数组
   * @returns 处理后的价格结果数组
   */
  public detectOutliers(prices: PriceResult[]): PriceResult[] {
    // 过滤出成功的结果
    const successfulPrices = prices.filter(p => p.success && p.price !== undefined);
    
    // 如果没有足够的价格数据，无法检测异常值
    if (successfulPrices.length <= 1) {
      return prices;
    }
    
    // 计算平均价格和标准偏差
    const validPrices = successfulPrices.map(p => p.price as number);
    const avgPrice = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
    
    // 计算标准偏差
    const squareDiffs = validPrices.map(price => {
      const diff = price - avgPrice;
      return diff * diff;
    });
    const avgSquareDiff = squareDiffs.reduce((sum, diff) => sum + diff, 0) / squareDiffs.length;
    const stdDev = Math.sqrt(avgSquareDiff);
    
    console.log(`[PriceAggregator] 平均价格: ${avgPrice}, 标准偏差: ${stdDev}`);
    
    // 标记异常值 (与平均值相差超过2个标准差)
    const threshold = stdDev * 2;
    
    // 创建结果副本，以便保留原始数据
    const result = prices.map(priceResult => {
      // 只处理成功的价格结果
      if (priceResult.success && priceResult.price !== undefined) {
        const price = priceResult.price;
        const diff = Math.abs(price - avgPrice);
        
        // 如果差异超过阈值，标记为异常值
        if (diff > threshold && diff / avgPrice > 0.1) { // 差异超过10%
          console.log(`[PriceAggregator] 检测到异常价格: ${priceResult.exchange} 价格 ${price} 与平均价 ${avgPrice} 相差太大`);
          
          return {
            ...priceResult,
            isOutlier: true
          };
        }
      }
      
      return { ...priceResult };
    });
    
    return result;
  }
  
  /**
   * 获取最佳价格
   * @param prices 价格结果数组
   * @returns 最佳价格结果
   */
  public getBestPrice(prices: PriceResult[]): PriceResult | null {
    // 过滤出成功且非异常值的结果
    const validPrices = prices.filter(p => p.success && p.price !== undefined && !p.isOutlier);
    
    if (validPrices.length === 0) {
      return null;
    }
    
    // 如果只有一个有效价格，直接返回
    if (validPrices.length === 1) {
      return validPrices[0];
    }
    
    // 计算中位数价格
    const sortedPrices = [...validPrices].sort((a, b) => (a.price as number) - (b.price as number));
    const medianIndex = Math.floor(sortedPrices.length / 2);
    
    return sortedPrices[medianIndex];
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
    // 过滤出成功且非异常值的结果
    const validPrices = prices.filter(p => p.success && p.price !== undefined && !p.isOutlier);
    
    if (validPrices.length === 0) {
      return {};
    }
    
    // 排序价格
    const sortedPrices = [...validPrices].sort((a, b) => (a.price as number) - (b.price as number));
    
    // 最低和最高价格
    const lowest = sortedPrices[0];
    const highest = sortedPrices[sortedPrices.length - 1];
    
    // 计算平均价格
    const validPriceValues = validPrices.map(p => p.price as number);
    const average = validPriceValues.reduce((sum, price) => sum + price, 0) / validPriceValues.length;
    
    // 计算中位数价格
    const medianIndex = Math.floor(sortedPrices.length / 2);
    const median = sortedPrices[medianIndex].price as number;
    
    // 计算最高和最低价格的差异百分比
    const diff = (highest.price as number) / (lowest.price as number) - 1;
    
    return {
      lowest,
      highest,
      average,
      median,
      diff
    };
  }
}

// 创建单例实例
const priceAggregator = new PriceAggregator();

export default priceAggregator; 