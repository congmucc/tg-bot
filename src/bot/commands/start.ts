import { Context } from 'telegraf';

/**
 * 处理开始命令
 * @param ctx Telegraf上下文
 */
export async function handleStartCommand(ctx: Context): Promise<void> {
  await ctx.sendChatAction('typing');
  
  const userName = ctx.from?.first_name || '用户';
  
  const welcomeMessage = `
🚀 *欢迎使用加密货币分析助手！*

你好 ${userName}！我是您的专业加密货币分析助手，可以帮助您：

💰 *价格查询与聚合*
• 实时价格查询 - /price BTC
• 多平台价格对比 - /compare ETH
• 发现套利机会

📊 *市场分析*
• 恐惧贪婪指数 - /fear
• 价格趋势分析 - /trend SOL 7d
• 高级交易系统 - /trade 买 ETH/USDC 0.5

🚀 *高级交易功能*
• MEV保护交易 - /trade 买 ETH/USDC 1 2.5
• 智能路由分析 - /trade route ETH/USDC 1000
• DCA定投策略 - /trade dca BTC/USDC 1000 7d
• TWAP分批交易 - /trade twap ETH/USDC 500 5 30m
• 止损保护 - /trade stop ETH/USDC 2300 0.5

🐋 *鲸鱼监控*
• 大额交易监控 - /whale 10
• 支持 ETH、SOL、BTC、Hyperliquid
• 实时WebSocket监控

🔔 *监控功能*
• 钱包跟踪 - /track eth 0x...
• 流动性分析 - /liquidity

📈 *数据源覆盖*
• 6-8个价格源聚合
• CEX: Binance, OKX, Coinbase, Huobi
• DEX: Uniswap, 1inch, Raydium
• 聚合器: CoinGecko, Jupiter, CryptoCompare

🎯 *快速开始*
试试这些命令：
• /price BTC - 查看比特币价格
• /compare ETH - 以太坊价格聚合
• /whale - 开始鲸鱼监控
• /trend SOL 7d - 查看Solana趋势
• /help - 查看完整命令列表

让我们开始探索加密货币市场吧！🌟
  `;

  await ctx.replyWithMarkdown(welcomeMessage);
}

export default {
  handleStartCommand
};
