import { Context } from 'telegraf';
import { getLPInfo, getUserLPShare, calculateImpermanentLoss, formatImpermanentLossMessage } from '../../services/liquidity';
import { dexConfigs } from '../../config';
import { BlockchainType } from '../../api/blockchain';

/**
 * 处理流动性分析命令
 * @param ctx Telegraf上下文
 */
export async function handleLiquidityCommand(ctx: Context): Promise<void> {
  await ctx.sendChatAction('typing');
  
  const message = ctx.message;
  // 确保消息是文本消息
  if (!message || !('text' in message)) {
    await ctx.reply('无法处理此类消息');
    return;
  }
  
  // 解析命令参数
  const args = message.text.split(' ').filter(arg => arg.trim() !== '');
  
  // 显示使用帮助
  if (args.length === 1) {
    await ctx.replyWithMarkdown(
      `*流动性分析*\n\n` +
      `查询LP信息，格式：/liquidity [LP地址] [链(eth|sol)]\n` +
      `查询用户LP份额：/liquidity [LP地址] [用户地址] [链(eth|sol)]\n` +
      `计算无常损失：/liquidity impermanent [初始价格] [当前价格]\n\n` +
      `示例：\n` +
      `/liquidity 0x3041CbD36888bECc7bbCBc0045E3B1f144466f5f eth\n` +
      `/liquidity 0x3041CbD36888bECc7bbCBc0045E3B1f144466f5f 0xYourAddress eth\n` +
      `/liquidity impermanent 10 15`
    );
    return;
  }
  
  // 如果是计算无常损失的命令
  if (args[1].toLowerCase() === 'impermanent') {
    await handleImpermanentLoss(ctx, args);
    return;
  }
  
  // 获取LP地址参数
  const lpAddress = args[1];
  
  // 检查地址格式
  if (!lpAddress.startsWith('0x') || lpAddress.length !== 42) {
    await ctx.reply('LP地址格式不正确，请提供有效的合约地址（以0x开头，42个字符）');
    return;
  }
  
  // 确定是用户LP查询还是普通LP信息查询
  const isUserLpQuery = args.length > 2 && args[2].startsWith('0x') && args[2].length === 42;
  
  // 确定网络链
  const chain = (isUserLpQuery ? args[3] : args[2])?.toLowerCase();
  if (!chain || (chain !== 'eth' && chain !== 'sol')) {
    await ctx.reply('请指定有效的链: eth 或 sol');
    return;
  }
  
  // 映射链名
  const chainType = chain === 'eth' ? 'ethereum' : 'solana';
  
  try {
    // 如果是用户LP查询
    if (isUserLpQuery) {
      const userAddress = args[2];
      await ctx.reply(`正在分析用户 ${userAddress} 在 ${lpAddress} 上的LP份额...`);
      
      const userLpInfo = await getUserLPShare(chainType, lpAddress, userAddress);
      
      const message = `
💧 *用户LP份额分析*
----------------------
📝 LP地址: \`${lpAddress}\`
👤 用户地址: \`${userAddress}\`
🔗 网络: ${chainType === 'ethereum' ? 'Ethereum' : 'Solana'}

💼 *LP份额*
LP余额: ${userLpInfo.lpBalance}
占比: ${userLpInfo.sharePercent}

🪙 *代币份额*
${userLpInfo.token0.symbol}: ${userLpInfo.token0.userAmount}
${userLpInfo.token1.symbol}: ${userLpInfo.token1.userAmount}
      `;
      
      await ctx.replyWithMarkdown(message);
    } else {
      // 普通LP信息查询
      await ctx.reply(`正在分析LP ${lpAddress} 的信息...`);
      
      const lpInfo = await getLPInfo(chainType, lpAddress);
      
      const message = `
💧 *LP信息分析*
----------------------
📝 LP地址: \`${lpAddress}\`
🔗 网络: ${chainType === 'ethereum' ? 'Ethereum' : 'Solana'}

🪙 *代币对信息*
代币对: ${lpInfo.token0.symbol}/${lpInfo.token1.symbol}
总供应量: ${lpInfo.totalSupply}

💰 *流动性储备*
${lpInfo.token0.symbol}: ${lpInfo.token0.reserve}
${lpInfo.token1.symbol}: ${lpInfo.token1.reserve}

⚖️ *价格*
1 ${lpInfo.token0.symbol} = ${(parseFloat(lpInfo.token1.reserve) / parseFloat(lpInfo.token0.reserve)).toFixed(6)} ${lpInfo.token1.symbol}
1 ${lpInfo.token1.symbol} = ${(parseFloat(lpInfo.token0.reserve) / parseFloat(lpInfo.token1.reserve)).toFixed(6)} ${lpInfo.token0.symbol}
      `;
      
      await ctx.replyWithMarkdown(message);
    }
  } catch (error) {
    const err = error as Error;
    await ctx.reply(`分析LP信息时发生错误: ${err.message}`);
  }
}

/**
 * 处理无常损失计算命令
 * @param ctx Telegraf上下文
 * @param args 命令参数
 */
async function handleImpermanentLoss(ctx: Context, args: string[]): Promise<void> {
  if (args.length < 4) {
    await ctx.reply('计算无常损失需要提供初始价格和当前价格，例如：/liquidity impermanent 10 15');
    return;
  }
  
  const initialPrice = parseFloat(args[2]);
  const currentPrice = parseFloat(args[3]);
  
  if (isNaN(initialPrice) || isNaN(currentPrice) || initialPrice <= 0 || currentPrice <= 0) {
    await ctx.reply('请提供有效的价格数值（必须为大于0的数字）');
    return;
  }
  
  try {
    // 计算无常损失百分比
    const lossPercent = calculateImpermanentLoss(initialPrice, currentPrice);
    
    // 生成说明消息
    const formattedMessage = formatImpermanentLossMessage(`Token A/Token B`, lossPercent);
    
    await ctx.replyWithMarkdown(formattedMessage);
    
    // 添加补充说明
    const additionalInfo = `
💡 *关于无常损失*
无常损失是指相比于持有Token，LP提供流动性获得的资产价值变化。
- 初始价格: ${initialPrice}
- 当前价格: ${currentPrice}
- 价格变化: ${((currentPrice / initialPrice - 1) * 100).toFixed(2)}%
- 无常损失: ${Math.abs(lossPercent).toFixed(2)}%

即使有无常损失，LP也可能通过手续费收益获得净盈利。
    `;
    
    await ctx.replyWithMarkdown(additionalInfo);
  } catch (error) {
    const err = error as Error;
    await ctx.reply(`计算无常损失时发生错误: ${err.message}`);
  }
} 