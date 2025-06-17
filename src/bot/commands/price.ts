import { Context } from 'telegraf';
import { getTokenPrice, formatTokenPrice, getCexTokenPrice } from '../../services/price';

// 常用加密货币符号 - 只保留市值最高的
const COMMON_TOKENS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'BNB'
];



// 自定义价格信息接口，兼容不同来源的价格数据
interface PriceInfo {
  price: number;
  change24h: number | null;
  source: string;
  time: string;
}

/**
 * 处理代币价格查询命令
 * @param ctx Telegraf上下文
 */
export async function handlePriceCommand(ctx: Context): Promise<void> {
  await ctx.sendChatAction('typing');
  
  const message = ctx.message;
  // 确保消息是文本消息
  if (!message || !('text' in message)) {
    await ctx.reply('无法处理此类消息');
    return;
  }
  
  // 解析命令参数
  const args = message.text.split(' ').filter(arg => arg.trim() !== '');
  
  // 如果没有指定代币，显示常用代币价格
  if (args.length === 1) {
    await showCommonTokenPrices(ctx);
    return;
  }
  

  
  const tokenSymbol = args[1].toUpperCase();
  
  // 如果是帮助命令，显示帮助信息
  if (tokenSymbol === 'HELP' || tokenSymbol === '帮助') {
    await ctx.reply(
      `💰 *价格查询命令使用说明*\n\n` +
      `• */price* - 显示常用代币的价格\n` +
      `• */price [代币符号]* - 查询特定代币的价格\n\n` +
      `*例子:*\n` +
      `• */price SOL* - 查询SOL的USD价格\n` +
      `• */price BTC* - 查询BTC的USD价格\n\n` +
      `*支持的代币:* BTC, ETH, SOL, XRP, BNB 等主流代币`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  const baseSymbol = args.length > 2 ? args[2].toUpperCase() : 'USDC';
  
  // 显示加载消息
  const loadingMsg = await ctx.reply(`⏳ 正在查询 ${tokenSymbol}/${baseSymbol} 价格...`);
  
  try {
    console.log(`正在查询${tokenSymbol}价格...`);

    // 优先使用CoinGecko API获取价格
    const priceResult = await getTokenPrice(tokenSymbol);

    if (!priceResult.success || !priceResult.usdPrice) {
      await ctx.telegram.editMessageText(
        loadingMsg.chat.id,
        loadingMsg.message_id,
        undefined,
        `❌ 未能获取 ${tokenSymbol} 的价格信息。\n\n` +
        `错误: ${priceResult.error || '未知错误'}\n\n` +
        `请检查代币符号是否正确，或稍后重试。`
      );
      return;
    }

    const priceInfo: PriceInfo = {
      price: priceResult.usdPrice,
      change24h: priceResult.priceChange24h || null,
      source: priceResult.source || 'CoinGecko',
      time: new Date().toISOString()
    };
    
    // 格式化价格输出
    const formattedPrice = formatTokenPrice(priceInfo.price);
    
    // 构建响应消息
    let responseMsg = `💰 *${tokenSymbol}/${baseSymbol} 价格*\n\n`;
    responseMsg += `📊 当前价格: *${formattedPrice} ${baseSymbol}*\n`;
    
    if (priceInfo.change24h !== null && priceInfo.change24h !== undefined) {
      const changeSymbol = priceInfo.change24h >= 0 ? '📈' : '📉';
      const changeColor = priceInfo.change24h >= 0 ? '🟢' : '🔴';
      responseMsg += `${changeSymbol} 24小时变化: ${changeColor} *${priceInfo.change24h.toFixed(2)}%*\n`;
    }
    
    responseMsg += `\n🔄 数据来源: ${priceInfo.source}\n`;
    responseMsg += `⏱️ 更新时间: ${new Date().toLocaleString('zh-CN')}\n`;
    
    // 添加建议
    responseMsg += `\n💡 *其他操作:*\n`;
    responseMsg += `• 查看更多交易所价格: /compare ${tokenSymbol} ${baseSymbol}\n`;
    responseMsg += `• 查看代币趋势: /trend ${tokenSymbol}`;
    
    // 发送消息
    await ctx.telegram.editMessageText(
      loadingMsg.chat.id,
      loadingMsg.message_id,
      undefined,
      responseMsg,
      { parse_mode: 'Markdown' }
    );
  } catch (error: any) {
    await ctx.telegram.editMessageText(
      loadingMsg.chat.id,
      loadingMsg.message_id,
      undefined,
      `❌ 查询价格时出错: ${error.message}`
    );
  }
}





/**
 * 显示常用代币价格
 */
async function showCommonTokenPrices(ctx: Context): Promise<void> {
  try {
    const waitingMsg = await ctx.reply('⏳ 正在获取常用代币价格...');
    
    // 常用代币列表 - 只保留市值最高的
    const commonTokens = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB'];
    
    // 定义价格结果类型
    interface TokenPrice {
      symbol: string;
      price: number;
      formattedPrice: string;
    }
    
    // 收集价格结果
    const tokenPrices: TokenPrice[] = [];
    const promises = [];
    
    // 并行获取所有代币价格
    for (const symbol of commonTokens) {
      promises.push(
        (async () => {
          try {
            // 优先从CEX获取主流代币价格
            const cexPriceResult = await getCexTokenPrice(symbol);
            if (cexPriceResult.success && cexPriceResult.price) {
              tokenPrices.push({
                symbol,
                price: cexPriceResult.price,
                formattedPrice: formatTokenPrice(cexPriceResult.price, 'USDT')
              });
              return;
            }
            
            // 如果CEX失败，尝试使用标准API
            const priceData = await getTokenPrice(symbol);
            if (priceData.success && priceData.usdPrice) {
              tokenPrices.push({
                symbol,
                price: priceData.usdPrice,
                formattedPrice: formatTokenPrice(priceData.usdPrice, 'USDT')
              });
            }
          } catch (error) {
            console.error(`获取${symbol}价格失败:`, error);
          }
        })()
      );
    }
    
    // 等待所有查询完成
    await Promise.all(promises);
    
    // 按照价格从高到低排序
    tokenPrices.sort((a, b) => b.price - a.price);
    
    // 构建响应消息
    let responseMsg = `💰 *常用加密货币价格*\n---------------------\n\n`;
    
    // 添加每个代币的价格
    for (const token of tokenPrices) {
      responseMsg += `• *${token.symbol}*: ${token.formattedPrice}\n`;
    }
    
    // 添加更新时间
    responseMsg += `\n⏱️ 更新时间: ${new Date().toLocaleString('zh-CN')}\n`;
    responseMsg += `\n_使用 /price [代币符号] 查询特定代币的价格_`;
    
    // 发送结果
    await ctx.telegram.editMessageText(
      waitingMsg.chat.id,
      waitingMsg.message_id,
      undefined,
      responseMsg,
      { parse_mode: 'Markdown' }
    );
  } catch (error: any) {
    const err = error as Error;
    await ctx.reply(`获取加密货币价格失败: ${err.message}`);
  }
} 