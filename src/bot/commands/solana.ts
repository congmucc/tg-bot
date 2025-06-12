import { Context } from 'telegraf';
import solanaAPI from '../../api/blockchain/solana';
import { getCryptoPrice } from '../../services/price';

/**
 * 处理Solana命令
 * @param ctx Telegraf上下文
 */
export async function handleSolanaCommand(ctx: Context): Promise<void> {
  await ctx.sendChatAction('typing');
  
  try {
    // 获取SOL价格
    const solPrice = await getCryptoPrice('sol');
    
    // 获取Solana网络信息
    const blockInfo = await solanaAPI.getLatestBlockInfo();
    
    // 获取大额交易
    const largeTransactions = await solanaAPI.getLargeTransactions(1000, 3);
    
    // 构建响应消息
    let responseMessage = `
📊 *Solana网络状态*
---------------------
💰 SOL价格: $${solPrice.market_data.current_price.usd.toFixed(2)}
📈 24小时涨跌: ${solPrice.market_data.price_change_percentage_24h.toFixed(2)}%
🌐 市值: $${(solPrice.market_data.market_cap.usd / 1000000000).toFixed(2)}B

🔍 *区块链状态*
---------------------
🔢 最新区块: #${blockInfo.number.toLocaleString()}
⏱ 区块时间: ${new Date(blockInfo.timestamp).toLocaleString()}
📝 包含交易数: ${blockInfo.transactions}
    `;
    
    // 添加大额交易信息（如果有）
    if (largeTransactions && largeTransactions.length > 0) {
      responseMessage += `\n🐳 *最近大额交易*\n---------------------\n`;
      
      for (const tx of largeTransactions) {
        const amount = parseFloat(tx.amount);
        const formattedAmount = amount > 1000 ? `${(amount / 1000).toFixed(2)}K SOL` : `${amount.toFixed(2)} SOL`;
        
        responseMessage += `⚡ ${formattedAmount} - ${tx.txHash.slice(0, 8)}...${tx.txHash.slice(-6)}\n`;
      }
    }
    
    responseMessage += `\n使用 /whale 命令可查看更多大额交易`;
    
    await ctx.replyWithMarkdown(responseMessage);
  } catch (error) {
    const err = error as Error;
    await ctx.reply(`获取Solana网络状态失败: ${err.message}`);
  }
} 