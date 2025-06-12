import { Context } from 'telegraf';
import { monitorLargeTransactions } from '../../api/blockchain';
import { formatAmount } from '../../utils';

/**
 * 处理鲸鱼监控命令
 * @param ctx Telegraf上下文
 */
export async function handleWhaleCommand(ctx: Context): Promise<void> {
  await ctx.sendChatAction('typing');
  
  const message = ctx.message;
  // 确保消息是文本消息
  if (!message || !('text' in message)) {
    await ctx.reply('无法处理此类消息');
    return;
  }
  
  // 解析命令参数
  const args = message.text.split(' ').filter(arg => arg.trim() !== '');
  
  // 默认监控值设置
  let minValueEth = 100; // 以太坊默认100 ETH
  let minValueSol = 500; // Solana默认500 SOL
  
  // 如果指定了金额参数
  if (args.length > 1) {
    try {
      const amount = parseFloat(args[1]);
      if (!isNaN(amount) && amount > 0) {
        minValueEth = amount;
        minValueSol = amount * 5; // Solana金额通常比ETH高几倍
      }
    } catch (error) {
      // 忽略解析错误，使用默认值
    }
  }
  
  try {
    await ctx.reply(`正在监控大额交易，以太坊门槛: ${minValueEth} ETH，Solana门槛: ${minValueSol} SOL...`);
    
    // 获取大额交易
    const results = await monitorLargeTransactions(minValueEth, minValueSol);
    
    // 处理结果
    for (const chainResult of results) {
      let message: string;
      
      if (chainResult.success) {
        const transactions = chainResult.transactions;
        
        if (transactions.length === 0) {
          message = `${chainResult.chain === 'ethereum' ? '以太坊' : 'Solana'}网络: 暂无符合条件的大额交易`;
        } else {
          message = `
🐳 *${chainResult.chain === 'ethereum' ? '以太坊' : 'Solana'}网络大额转账*
---------------------
`;
          
          const limit = Math.min(5, transactions.length); // 最多显示5笔大额转账
          
          for (let i = 0; i < limit; i++) {
            const tx = transactions[i];
            const txUrl = chainResult.chain === 'ethereum'
              ? `https://etherscan.io/tx/${tx.hash}`
              : `https://solscan.io/tx/${tx.hash}`;
              
            const symbol = chainResult.chain === 'ethereum' ? 'ETH' : 'SOL';
            const value = formatAmount(tx.value);
            
            message += `
💰 *${value} ${symbol}*
👤 从: [${tx.from.slice(0, 6)}...${tx.from.slice(-4)}](${chainResult.chain === 'ethereum' ? `https://etherscan.io/address/${tx.from}` : `https://solscan.io/account/${tx.from}`})
👥 至: [${tx.to.slice(0, 6)}...${tx.to.slice(-4)}](${chainResult.chain === 'ethereum' ? `https://etherscan.io/address/${tx.to}` : `https://solscan.io/account/${tx.to}`})
🔗 [查看交易](${txUrl})
⏰ ${new Date(tx.timestamp * 1000).toLocaleString()}
`;
          }
          
          if (transactions.length > limit) {
            message += `\n... 及其他 ${transactions.length - limit} 笔交易`;
          }
        }
      } else {
        message = `${chainResult.chain === 'ethereum' ? '以太坊' : 'Solana'}网络: 获取失败 - ${chainResult.error}`;
      }
      
      // 发送消息
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    const err = error as Error;
    await ctx.reply(`监控大额交易时发生错误: ${err.message}`);
  }
} 