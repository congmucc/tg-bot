import { Context } from 'telegraf';
import { Message } from 'telegraf/typings/core/types/typegram';
import { getTokenPrice, formatTokenPrice, getCommonTokenPrices, getCexTokenPrice } from '../../services/price';
import { resolveToken } from '../../services/tokenResolver';
import { getPriceAcrossDexes, isTokenSupported } from '../../api/dex';
import jupiterApi from '../../api/jupiterApi';
import { BOT_CONFIG } from '../../config/env';

// 常用加密货币符号
const COMMON_TOKENS = [
  'BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE'
];

// 主流交易所支持的代币符号
const MAINSTREAM_TOKENS = [
  'BTC', 'ETH', 'SOL'
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
  
  // 检查是否是搜索模式
  if (args[1].toLowerCase() === 'search' || args[1].toLowerCase() === '搜索') {
    if (args.length > 2) {
      const searchTerm = args.slice(2).join(' ');
      await handleTokenSearch(ctx, searchTerm);
      return;
    } else {
      await ctx.reply('请提供搜索关键词，例如: /price search WIF');
      return;
    }
  }
  
  const tokenSymbol = args[1].toUpperCase();
  
  // 如果是帮助命令，显示帮助信息
  if (tokenSymbol === 'HELP' || tokenSymbol === '帮助') {
    await ctx.replyWithMarkdown(
      `*💰 价格查询命令使用说明*\n\n` +
      `*/price* - 显示常用代币的价格\n` +
      `*/price [代币符号]* - 查询特定代币的价格\n` +
      `*/price search [关键词]* - 搜索匹配的代币\n` +
      `*/price [代币符号] [基础代币]* - 查询特定代币对的价格\n\n` +
      `*例子:*\n` +
      `*/price SOL* - 查询SOL的USDC价格\n` +
      `*/price BTC ETH* - 查询BTC对ETH的价格\n` +
      `*/price search WIF* - 搜索带有WIF的代币\n\n` +
      `*提示:* 使用 /compare 命令可以比较不同平台上的价格`
    );
    return;
  }
  
  const baseSymbol = args.length > 2 ? args[2].toUpperCase() : 'USDC';
  
  // 显示加载消息
  const loadingMsg = await ctx.reply(`⏳ 正在查询 ${tokenSymbol}/${baseSymbol} 价格...`);
  
  try {
    // 检查是否是主流代币
    const isMainstreamToken = MAINSTREAM_TOKENS.includes(tokenSymbol);
    let priceInfo: PriceInfo | null = null;
    
    // 对于主流代币，优先从CEX获取价格
    if (isMainstreamToken) {
      try {
        console.log(`${tokenSymbol}是主流代币，优先从CEX获取价格...`);
        const cexPriceResult = await getCexTokenPrice(tokenSymbol);
        if (cexPriceResult.success && cexPriceResult.price) {
          priceInfo = {
            price: cexPriceResult.price,
            change24h: null,
            source: cexPriceResult.source || '主流交易所',
            time: new Date().toISOString()
          };
        }
      } catch (error) {
        console.error(`从CEX获取${tokenSymbol}价格失败:`, error);
      }
    }
    
    // 如果从CEX没有获取到价格，尝试标准API
    if (!priceInfo) {
      // 尝试解析代币
      const tokenInfo = await resolveToken(tokenSymbol);
      
      if (!tokenInfo) {
        // 对于主流代币，再次尝试从交易所获取数据
        if (isMainstreamToken) {
          try {
            const cexPriceResult = await getCexTokenPrice(tokenSymbol);
            if (cexPriceResult.success && cexPriceResult.price) {
              // 找到价格，直接显示结果
              const formattedPrice = formatTokenPrice(cexPriceResult.price);
              
              let responseMsg = `💰 *${tokenSymbol}/${baseSymbol} 价格*\n\n`;
              responseMsg += `📊 当前价格: *${formattedPrice} ${baseSymbol}*\n`;
              responseMsg += `\n🔄 数据来源: ${cexPriceResult.source || '主流交易所'}\n`;
              responseMsg += `⏱️ 更新时间: ${new Date().toLocaleString('zh-CN')}\n`;
              
              // 添加建议
              responseMsg += `\n💡 *其他操作:*\n`;
              responseMsg += `• 查看更多交易所价格: /compare ${tokenSymbol} ${baseSymbol}\n`;
              responseMsg += `• 查看代币趋势: /trend ${tokenSymbol}`;
              
              await ctx.telegram.editMessageText(
                loadingMsg.chat.id,
                loadingMsg.message_id,
                undefined,
                responseMsg,
                { parse_mode: 'Markdown' }
              );
              return;
            }
          } catch (error) {
            console.error(`第二次尝试从CEX获取${tokenSymbol}价格失败:`, error);
          }
        }
        
        // 如果代币未找到，尝试使用Jupiter搜索
        try {
          console.log(`使用Jupiter搜索代币: ${tokenSymbol}...`);
          const results = await jupiterApi.searchToken(tokenSymbol);
          
          if (results.length > 0) {
            // 找到匹配的代币，通知用户
            await ctx.telegram.editMessageText(
              loadingMsg.chat.id, 
              loadingMsg.message_id, 
              undefined,
              `未找到精确匹配的 ${tokenSymbol}，但找到了以下相关代币:\n\n` +
              results.slice(0, 5).map((token, i) => 
                `${i+1}. ${token.symbol} (${token.name})\n` +
                `   价格: ${token.price ? formatPrice(token.price) + ' USDC' : '未知'}\n` +
                `   查看: /price ${token.symbol}`
              ).join('\n\n') +
              `\n\n使用 /price search ${tokenSymbol} 查看更多结果`
            );
            return;
          }
        } catch (error) {
          console.error('Jupiter搜索失败:', error);
        }
        
        // 如果代币未找到且Jupiter搜索也失败，提示用户
        await ctx.telegram.editMessageText(
          loadingMsg.chat.id, 
          loadingMsg.message_id, 
          undefined,
          `❌ 未找到代币 ${tokenSymbol}。\n\n请尝试使用 /price search ${tokenSymbol} 搜索相关代币。`
        );
        return;
      }

      // 使用标准价格API获取价格
      const standardPriceResult = await getTokenPrice(tokenSymbol);
      if (standardPriceResult.success && standardPriceResult.usdPrice) {
        priceInfo = {
          price: standardPriceResult.usdPrice,
          change24h: standardPriceResult.priceChange24h || null,
          source: standardPriceResult.source || 'CoinGecko',
          time: new Date().toISOString()
        };
      }
      
      // 如果标准API未能获取价格，尝试使用Jupiter作为备用
      if (!priceInfo && (tokenInfo.source === 'config' || tokenInfo.chainId === 101)) {
        try {
          console.log(`标准API无法获取价格，尝试使用Jupiter作为备用获取 ${tokenSymbol}/${baseSymbol} 价格...`);
          const jupiterPrice = await jupiterApi.getTokenPrice(tokenSymbol, baseSymbol);
          if (jupiterPrice !== null) {
            priceInfo = {
              price: jupiterPrice,
              change24h: null,
              source: 'Jupiter (备用)',
              time: new Date().toISOString()
            };
          }
        } catch (error) {
          console.error('Jupiter价格查询失败:', error);
        }
      }
    }
    
    if (!priceInfo) {
      await ctx.telegram.editMessageText(
        loadingMsg.chat.id, 
        loadingMsg.message_id, 
        undefined,
        `❌ 未能获取 ${tokenSymbol}/${baseSymbol} 的价格信息。\n\n` +
        `请尝试使用 /compare ${tokenSymbol} ${baseSymbol} 查看跨交易平台的价格数据。`
      );
      return;
    }
    
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
 * 处理代币搜索
 */
async function handleTokenSearch(ctx: Context, searchTerm: string): Promise<void> {
  try {
    // 发送等待消息
    const waitingMsg = await ctx.reply(`🔍 正在搜索代币: "${searchTerm}"...`);
    
    // 检查是否是主流代币的模糊匹配
    const upperSearchTerm = searchTerm.toUpperCase();
    const matchedMainstreamTokens = MAINSTREAM_TOKENS.filter(token => 
      token.includes(upperSearchTerm)
    );
    
    // 如果找到主流代币匹配，直接显示结果
    if (matchedMainstreamTokens.length > 0) {
      let responseMsg = `🔍 *找到 ${matchedMainstreamTokens.length} 个主流代币匹配:*\n\n`;
      
      // 并行获取所有匹配代币的价格
      const pricePromises = matchedMainstreamTokens.map(async (symbol) => {
        try {
          const priceResult = await getCexTokenPrice(symbol);
          return {
            symbol,
            price: priceResult.success ? priceResult.price : null,
            source: priceResult.success ? priceResult.source : null
          };
        } catch (error) {
          return { symbol, price: null, source: null };
        }
      });
      
      const priceResults = await Promise.all(pricePromises);
      
      // 构建响应消息
      for (let i = 0; i < priceResults.length; i++) {
        const result = priceResults[i];
        responseMsg += `${i + 1}. *${result.symbol}*\n`;
        if (result.price !== null) {
          responseMsg += `   💰 价格: ${formatPrice(result.price!)} USDC\n`;
          responseMsg += `   🔄 来源: ${result.source}\n`;
        } else {
          responseMsg += `   💰 价格: 未知\n`;
        }
        responseMsg += `   📈 查看价格: /price ${result.symbol}\n\n`;
      }
      
      // 如果只有一个匹配，自动触发价格查询
      if (matchedMainstreamTokens.length === 1) {
        responseMsg += `_自动查询 ${matchedMainstreamTokens[0]} 的价格_\n\n`;
        
        // 发送匹配结果
        await ctx.telegram.editMessageText(
          waitingMsg.chat.id,
          waitingMsg.message_id,
          undefined,
          responseMsg,
          { parse_mode: 'Markdown' }
        );
        
        // 触发价格查询
        await handlePriceCommand({
          ...ctx,
          message: { ...ctx.message, text: `/price ${matchedMainstreamTokens[0]}` }
        } as any);
        return;
      }
      
      // 发送结果
      await ctx.telegram.editMessageText(
        waitingMsg.chat.id,
        waitingMsg.message_id,
        undefined,
        responseMsg,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // 如果不是主流代币匹配，继续使用Jupiter搜索
    let results: any[] = [];
    try {
      results = await jupiterApi.searchToken(searchTerm);
    } catch (error) {
      console.error('Jupiter搜索失败:', error);
    }
    
    // TODO: 添加其他链的代币搜索
    
    if (results.length > 0) {
      // 构建搜索结果消息
      let responseMsg = `🔍 *找到 ${results.length} 个匹配的代币:*\n\n`;
      
      // 添加每个代币的信息
      for (let i = 0; i < Math.min(results.length, 10); i++) {
        const token = results[i];
        const symbol = token.symbol;
        const name = token.name;
        const price = token.price;
        
        // 格式化价格
        let priceText = '未知';
        if (price !== null) {
          priceText = formatPrice(price) + ' USDC';
        }
        
        responseMsg += `${i + 1}. *${symbol}* (${name})\n`;
        responseMsg += `   💰 价格: ${priceText}\n`;
        responseMsg += `   🔗 地址: \`${token.address}\`\n`;
        responseMsg += `   📈 查看价格: /price ${symbol}\n\n`;
      }
      
      responseMsg += `_使用 /price [代币符号] 查看指定代币的价格_`;
      
      // 发送结果
      await ctx.telegram.editMessageText(
        waitingMsg.chat.id,
        waitingMsg.message_id,
        undefined,
        responseMsg,
        { parse_mode: 'Markdown' }
      );
    } else {
      // 没有找到结果
      await ctx.telegram.editMessageText(
        waitingMsg.chat.id,
        waitingMsg.message_id,
        undefined,
        `❌ 未找到匹配 "${searchTerm}" 的代币。\n\n请尝试其他关键词。`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error: any) {
    console.error('Token search error:', error);
    await ctx.reply(`❌ 搜索代币时出错: ${error.message}`);
  }
}

/**
 * 格式化价格显示
 */
function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  } else if (price >= 1) {
    return price.toLocaleString('en-US', { maximumFractionDigits: 4 });
  } else if (price >= 0.0001) {
    return price.toLocaleString('en-US', { maximumFractionDigits: 6 });
  } else {
    return price.toExponential(4);
  }
}

/**
 * 显示常用代币价格
 */
async function showCommonTokenPrices(ctx: Context): Promise<void> {
  try {
    const waitingMsg = await ctx.reply('⏳ 正在获取常用代币价格...');
    
    // 常用代币列表
    const commonTokens = [
      'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 
      'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX'
    ];
    
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