import dexApi from './dex';
import blockchainApi from './blockchain';
import axios from 'axios';

// 导出所有API
export default {
  dex: dexApi,
  blockchain: blockchainApi,
};

// 集中导出常用函数
export const {
  getPriceAcrossDexes
} = dexApi;

export const {
  getBalanceAcrossChains,
  monitorLargeTransactions
} = blockchainApi;

/**
 * 获取加密货币市场情绪指数
 */
export async function getFearAndGreedIndex() {
  try {
    const response = await axios.get('https://api.alternative.me/fng/', {
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
 */
export async function getCryptoPrices(symbols = ['BTC', 'ETH', 'BNB']) {
  try {
    const symbolsStr = symbols.join(',');
    const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
      params: {
        ids: symbolsStr.toLowerCase(),
        vs_currencies: 'usd,cny'
      }
    });
    return response.data;
  } catch (error) {
    const err = error as Error;
    throw new Error(`获取加密货币价格失败: ${err.message}`);
  }
} 