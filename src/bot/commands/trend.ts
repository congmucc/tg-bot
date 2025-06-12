import { Context } from 'telegraf';
import axios from 'axios';
import { getTokenBySymbol } from '../../config/tokens';

interface PricePoint {
  timestamp: number;
  price: number;
}

// 时间范围选项
type TimeRange = '1d' | '7d' | '30d' | '90d';

/**
 * 获取代币历史价格
 * @param tokenId 代币ID (CoinGecko API使用)
 * @param range 时间范围
 */
async function getTokenPriceHistory(tokenId: string, range: TimeRange): Promise<PricePoint[]> {
  try {
    // 确定天数
    let days: number;
    switch (range) {
      case '1d': days = 1; break;
      case '7d': days = 7; break;
      case '30d': days = 30; break;
      case '90d': days = 90; break;
      default: days = 7;
    }
    
    // 调用CoinGecko API
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${tokenId}/market_chart`, {
        params: {
          vs_currency: 'usd',
          days: days
        }
      }
    );
    
    if (!response.data || !response.data.prices || !Array.isArray(response.data.prices)) {
      throw new Error('无效的价格数据格式');
    }
    
    // 格式化响应数据
    return response.data.prices.map((item: [number, number]) => ({
      timestamp: item[0],
      price: item[1]
    }));
    
  } catch (error) {
    const err = error as Error;
    throw new Error(`获取价格历史失败: ${err.message}`);
  }
}

/**
 * 分析价格趋势
 * @param prices 价格点数组
 */
function analyzeTrend(prices: PricePoint[]): {
  trend: 'up' | 'down' | 'neutral';
  changePercent: number;
  volatility: number;
  summary: string;
} {
  if (prices.length < 2) {
    return {
      trend: 'neutral',
      changePercent: 0,
      volatility: 0,
      summary: '数据不足，无法分析趋势'
    };
  }
  
  // 计算价格变化百分比
  const firstPrice = prices[0].price;
  const lastPrice = prices[prices.length - 1].price;
  const priceChange = lastPrice - firstPrice;
  const changePercent = (priceChange / firstPrice) * 100;
  
  // 确定趋势方向
  let trend: 'up' | 'down' | 'neutral' = 'neutral';
  if (changePercent > 1) trend = 'up';
  else if (changePercent < -1) trend = 'down';
  
  // 计算波动率 (价格标准差 / 平均价格)
  const avgPrice = prices.reduce((sum, point) => sum + point.price, 0) / prices.length;
  const sqDiffs = prices.map(point => Math.pow(point.price - avgPrice, 2));
  const avgSqDiff = sqDiffs.reduce((sum, val) => sum + val, 0) / sqDiffs.length;
  const volatility = (Math.sqrt(avgSqDiff) / avgPrice) * 100; // 波动率百分比
  
  // 生成趋势概要
  let summary = '';
  if (trend === 'up') {
    summary = `价格上升趋势，${changePercent.toFixed(2)}%的价格增长`;
    if (volatility > 10) summary += '，但波动较大，风险较高';
    else if (volatility < 3) summary += '，且波动较小，相对稳定增长';
  } else if (trend === 'down') {
    summary = `价格下降趋势，${Math.abs(changePercent).toFixed(2)}%的价格下跌`;
    if (volatility > 10) summary += '，且波动剧烈，建议谨慎';
    else if (volatility < 3) summary += '，且下跌平稳，可能持续承压';
  } else {
    summary = '价格相对稳定，无明显趋势';
    if (volatility > 5) summary += '，但存在波动，需注意风险';
    else summary += '，波动性低';
  }
  
  return {
    trend,
    changePercent,
    volatility,
    summary
  };
}

/**
 * 处理趋势命令
 * @param ctx Telegraf上下文
 */
export async function handleTrendCommand(ctx: Context): Promise<void> {
  await ctx.sendChatAction('typing');
  
  const message = ctx.message;
  // 确保消息是文本消息
  if (!message || !('text' in message)) {
    await ctx.reply('无法处理此类消息');
    return;
  }
  
  // 解析命令参数
  const args = message.text.split(' ').filter(arg => arg.trim() !== '');
  
  if (args.length === 1) {
    await ctx.replyWithMarkdown(
      `*价格趋势分析*\n\n` +
      `请使用格式: /trend [代币符号] [时间范围]\n` +
      `例如: /trend BTC 7d\n\n` +
      `时间范围选项:\n` +
      `- 1d: 1天\n` +
      `- 7d: 7天 (默认)\n` +
      `- 30d: 30天\n` +
      `- 90d: 90天`
    );
    return;
  }
  
  const tokenSymbol = args[1].toUpperCase();
  const timeRange = (args.length > 2 ? args[2].toLowerCase() : '7d') as TimeRange;
  
  // 验证时间范围参数
  if (!['1d', '7d', '30d', '90d'].includes(timeRange)) {
    await ctx.reply('无效的时间范围。请选择: 1d, 7d, 30d, 或 90d');
    return;
  }
  
  try {
    await ctx.reply(`正在分析 ${tokenSymbol} 在过去 ${timeRange} 的价格趋势...`);
    
    // 映射常见代币符号到CoinGecko ID
    const symbolToId: {[key: string]: string} = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'SOL': 'solana',
      'BNB': 'binancecoin',
      'USDT': 'tether',
      'USDC': 'usd-coin',
      'XRP': 'ripple',
      'ADA': 'cardano',
      'DOGE': 'dogecoin',
      'DOT': 'polkadot',
    };
    
    const tokenId = symbolToId[tokenSymbol] || tokenSymbol.toLowerCase();
    const prices = await getTokenPriceHistory(tokenId, timeRange);
    
    if (prices.length === 0) {
      await ctx.reply(`未找到 ${tokenSymbol} 的历史价格数据`);
      return;
    }
    
    const analysis = analyzeTrend(prices);
    const firstPrice = prices[0].price;
    const lastPrice = prices[prices.length - 1].price;
    
    // 格式化时间范围显示
    const rangeDisplay = {
      '1d': '24小时',
      '7d': '7天',
      '30d': '30天',
      '90d': '90天'
    }[timeRange];
    
    // 构建趋势图符号
    let trendSymbol = '➡️';
    if (analysis.trend === 'up') trendSymbol = '📈';
    else if (analysis.trend === 'down') trendSymbol = '📉';
    
    // 构建趋势消息
    const message = `
${trendSymbol} *${tokenSymbol} ${rangeDisplay}价格趋势分析*
---------------------
💰 当前价格: $${lastPrice.toFixed(2)}
🕒 ${rangeDisplay}前价格: $${firstPrice.toFixed(2)}
📊 价格变化: ${analysis.changePercent > 0 ? '+' : ''}${analysis.changePercent.toFixed(2)}%
📏 波动率: ${analysis.volatility.toFixed(2)}%

📝 *分析概要*
${analysis.summary}

🔮 *建议操作*
${analysis.trend === 'up' 
  ? '可能是买入机会，但请结合其他指标' 
  : analysis.trend === 'down' 
    ? '可能面临下跌风险，建议谨慎' 
    : '价格相对稳定，可以继续观察'}

⚠️ _此分析仅供参考，不构成投资建议_
    `;
    
    await ctx.replyWithMarkdown(message);
  } catch (error) {
    const err = error as Error;
    await ctx.reply(`分析价格趋势时出错: ${err.message}`);
  }
} 