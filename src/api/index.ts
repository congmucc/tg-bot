/**
 * API模块入口文件
 * 导出所有API实现和聚合器
 */

// 接口
export * from './interfaces/exchangeApi';

// CEX API
import binanceApi from './cex/binanceApi';
import okxApi from './cex/okxApi';
import coinbaseApi from './cex/coinbaseApi';
import krakenApi from './cex/krakenApi';
import huobiApi from './cex/huobiApi';
import cexManager from './cex';

// DEX API
import raydiumApi from './dex/raydium';
import uniswapApi from './dex/uniswap';
import oneInchApi from './dex/oneinchApi';
import dexManager from './dex';

// 聚合器
import priceAggregator from './aggregators/priceAggregator';
import jupiterAggregator from './aggregators/jupiterAggregator';
import aggregatorsManager from './aggregators';

// 导出DEX API
export const dexApis = {
  raydium: raydiumApi,
  uniswap: uniswapApi,
  '1inch': oneInchApi
};

// 导出CEX API
export const cexApis: Record<string, any> = {
  binance: binanceApi,
  okx: okxApi,
  coinbase: coinbaseApi,
  kraken: krakenApi,
  huobi: huobiApi
};

// 导出聚合器
export const aggregators: Record<string, any> = {
  price: priceAggregator,
  jupiter: jupiterAggregator
};

// 导出管理器
export const managers = {
  cex: cexManager,
  dex: dexManager,
  aggregators: aggregatorsManager
};

// 默认导出所有API
export default {
  dex: dexApis,
  cex: cexApis,
  aggregators,
  managers
}; 