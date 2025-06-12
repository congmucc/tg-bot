import HttpClient from '../http/httpClient';
import { API_CONFIG } from '../../config/env';

/**
 * 获取加密货币市场情绪指数
 * @returns 恐惧贪婪指数数据
 */
export async function getFearAndGreedIndex() {
  try {
    const http = HttpClient.create();
    const response = await http.get('https://api.alternative.me/fng/', undefined, {
      timeout: 5000 // 5秒超时
    });
    
    // 检查返回数据
    if (!response.data || !response.data.data || !Array.isArray(response.data.data) || response.data.data.length === 0) {
      throw new Error('API返回数据不完整');
    }
    
    // 验证关键字段
    const current = response.data.data[0];
    if (!current || !current.value || !current.value_classification || !current.timestamp) {
      throw new Error('当前数据不完整');
    }
    
    return response.data;
  } catch (error) {
    const err = error as Error;
    throw new Error(`获取恐惧贪婪指数失败: ${err.message}`);
  }
}

/**
 * 获取主要加密货币价格
 * @param symbols 代币符号列表
 * @param currencies 法币列表
 * @returns 加密货币价格数据
 */
export async function getCryptoPrices(symbols = ['BTC', 'ETH', 'BNB'], currencies = ['usd', 'cny']) {
  try {
    const http = HttpClient.create(API_CONFIG.COINGECKO_API);
    const symbolsStr = symbols.join(',');
    const currenciesStr = currencies.join(',');
    
    const response = await http.get('/simple/price', {
      ids: symbolsStr.toLowerCase(),
      vs_currencies: currenciesStr.toLowerCase()
    });
    
    return response.data;
  } catch (error) {
    const err = error as Error;
    throw new Error(`获取加密货币价格失败: ${err.message}`);
  }
}

/**
 * 获取加密货币历史价格数据
 * @param symbol 代币符号
 * @param days 天数
 * @param currency 法币
 * @returns 历史价格数据
 */
export async function getHistoricalPrices(symbol: string, days = 7, currency = 'usd') {
  try {
    const http = HttpClient.create(API_CONFIG.COINGECKO_API);
    const response = await http.get(`/coins/${symbol.toLowerCase()}/market_chart`, {
      vs_currency: currency,
      days: days,
      interval: days > 30 ? 'daily' : 'hourly'
    });
    
    return response.data;
  } catch (error) {
    const err = error as Error;
    throw new Error(`获取历史价格数据失败: ${err.message}`);
  }
}

/**
 * 计算价格变化百分比
 * @param oldPrice 旧价格
 * @param newPrice 新价格
 * @returns 价格变化百分比
 */
export function calculatePriceChangePercent(oldPrice: number, newPrice: number): number {
  if (oldPrice <= 0) {
    return 0;
  }
  
  return ((newPrice - oldPrice) / oldPrice) * 100;
}

/**
 * 格式化价格显示
 * @param price 价格
 * @param currency 货币符号
 * @param decimals 小数位数
 * @returns 格式化后的价格字符串
 */
export function formatPrice(price: number, currency = 'USD', decimals = 2): string {
  if (price === undefined || price === null || isNaN(price)) {
    return 'N/A';
  }
  
  // 为小额价格使用更多小数位
  const finalDecimals = price < 0.01 ? 6 : price < 1 ? 4 : decimals;
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: finalDecimals,
    maximumFractionDigits: finalDecimals
  }).format(price);
}

/**
 * 获取价格变化颜色 (用于UI显示)
 * @param changePercent 变化百分比
 * @returns 颜色代码
 */
export function getPriceChangeColor(changePercent: number): string {
  if (changePercent > 0) {
    return '#00C853'; // 绿色 (上涨)
  } else if (changePercent < 0) {
    return '#FF5252'; // 红色 (下跌)
  } else {
    return '#9E9E9E'; // 灰色 (持平)
  }
} 