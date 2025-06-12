import { IPriceAggregator } from '../interfaces/exchangeApi';
import jupiterAggregator from './jupiterAggregator';
import priceAggregator from './priceAggregator';

/**
 * 聚合器管理器类
 */
class AggregatorsManager {
  public aggregators: IPriceAggregator[];

  constructor() {
    this.aggregators = [
      jupiterAggregator,
      priceAggregator
    ];
  }

  /**
   * 获取所有聚合器
   */
  public getAggregators(): IPriceAggregator[] {
    return this.aggregators;
  }

  /**
   * 根据名称获取聚合器
   * @param name 聚合器名称
   */
  public getAggregatorByName(name: string): IPriceAggregator | undefined {
    return this.aggregators.find(agg => agg.getName().toLowerCase() === name.toLowerCase());
  }

  /**
   * 获取Jupiter聚合器
   */
  public get jupiter(): IPriceAggregator {
    return jupiterAggregator;
  }

  /**
   * 获取通用价格聚合器
   */
  public get price(): IPriceAggregator {
    return priceAggregator;
  }
}

// 创建并导出实例
const aggregatorsManager = new AggregatorsManager();
export default aggregatorsManager;

// 导出各个聚合器
export {
  jupiterAggregator,
  priceAggregator
}; 