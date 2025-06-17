import { Context } from 'telegraf';

/**
 * 处理帮助命令
 * @param ctx Telegraf上下文
 */
export async function handleHelpCommand(ctx: Context): Promise<void> {
  await ctx.sendChatAction('typing');
  
  const helpMessage = `
📚 *加密货币分析助手使用指南*
---------------------

这个机器人可以帮助您分析加密货币市场，监控价格和发现交易机会。

🔎 *价格查询与比较*
---------------------
/price [代币符号] - 查询代币价格、交易量和市值
/compare [代币符号] - 交易平台价格聚合(DEX+CEX)

📊 *市场分析*
---------------------
/fear - 查看市场恐惧贪婪指数
/trend [代币符号] [天数] - 市场趋势预测和技术分析
/trade [代币符号] - 获取交易建议

💰 *跨链与交易分析*
---------------------
/liquidity [池ID/代币对] [链] - 分析流动性池

🔔 *提醒与监控*
---------------------
/alert [代币符号] [条件] [价格] - 设置价格提醒
/track [链] [地址] [名称] - 跟踪钱包资产
/whale [数量] - 监控大额转账

使用 /start 可以打开主菜单。
`;

  await ctx.replyWithMarkdown(helpMessage);
}

export default {
  handleHelpCommand
}; 