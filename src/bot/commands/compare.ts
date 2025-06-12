import { Context } from 'telegraf';
import { getPriceAcrossDexes } from '../../api/dex';
import { isValidToken, resolveToken } from '../../services/tokenResolver';
import jupiterAggregator from '../../api/aggregators/jupiterAggregator';
import { formatTokenPrice } from '../../services/price';
import { getPriceFromCexes, CexPriceResult } from '../../api/cex';

/**
 * Jupiter价格查询结果接口
 */
interface JupiterPriceResult {
  success: boolean;
  price?: number;
}

/**
 * DEX价格结果接口
 */
interface DexPriceResult {
  dex: string;
  chain: string;
  success: boolean;
  price?: string;
  error?: string;
}

/**
 * 价格信息，用于标记异常值
 */
interface PriceInfo {
  dex: string;
  chain: string;
  price: number;
  isOutlier: boolean;
}

/**
 * 处理比较价格命令
 * @param ctx Telegraf上下文
 */
export async function handleCompareCommand(ctx: Context): Promise<void> {
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
      `*交易平台价格聚合*\n\n` +
      `请使用格式: /compare [代币符号] [基础代币符号]\n` +
      `例如: /compare ETH USDT\n\n` +
      `这将聚合并比较不同平台上ETH的价格数据。\n` +
      `- DEX: Uniswap(以太坊)、Raydium(Solana)、PancakeSwap(BSC)等\n` +
      `- CEX: 币安、OKX、Coinbase等\n\n` +
      `如果不指定基础代币，默认使用USDC。\n` +
      `支持的基础代币包括: USDC, USDT, ETH, SOL, BTC等。`
    );
    return;
  }
  
  // 获取代币符号
  const tokenSymbol = args[1].toUpperCase();
  // 默认使用USDC作为基础代币
  const baseTokenSymbol = args.length > 2 ? args[2].toUpperCase() : 'USDC';
  
  try {
    // 展示正在处理信息，因为token resolver可能需要时间
    await ctx.reply(`正在处理您的请求，解析代币 ${tokenSymbol}...`);
    
    // 使用新的token resolver服务验证代币
    const tokenInfo = await resolveToken(tokenSymbol);
    
    // 同时验证基础代币
    const baseTokenInfo = await resolveToken(baseTokenSymbol);
    
    if (!tokenInfo) {
      // 尝试检查是否为包装代币
      const wrappedSymbol = 'W' + tokenSymbol;
      const wrappedTokenInfo = await resolveToken(wrappedSymbol);
      
      let errorMsg = `未找到代币 ${tokenSymbol}`;
      
      if (wrappedTokenInfo) {
        errorMsg += `\n提示: 您可能想要搜索 ${wrappedSymbol} (${tokenSymbol}的包装版本)`;
      }
      
      await ctx.reply(errorMsg);
      return;
    }
    
    if (!baseTokenInfo) {
      await ctx.reply(`未找到基础代币 ${baseTokenSymbol}，请尝试使用USDC或USDT作为基础代币`);
      return;
    }
    
    const waitingMsg = await ctx.reply(`正在获取 ${tokenInfo.symbol} (${tokenInfo.name}) 在不同平台上的数据...`);
    
    // 并行获取所有价格数据
    // 1. 获取DEX价格
    const dexPromise: Promise<DexPriceResult[]> = getPriceAcrossDexes(tokenSymbol, baseTokenSymbol);
    
    // 2. 获取CEX价格
    const cexPromise: Promise<CexPriceResult[]> = getPriceFromCexes(tokenSymbol, baseTokenSymbol);
    
    // 3. 获取Jupiter价格
    const jupiterPromise: Promise<JupiterPriceResult> = (async () => {
      try {
        const jupiterPriceResult = await jupiterAggregator.getTokenPrice(tokenSymbol, baseTokenSymbol);
        if (jupiterPriceResult.success && jupiterPriceResult.price !== undefined) {
          console.log(`[Jupiter] 获取的价格: ${jupiterPriceResult.price}`);
          return {
            success: true,
            price: jupiterPriceResult.price
          };
        }
        return { success: false };
      } catch (error) {
        console.error('Jupiter价格查询失败:', error);
        return { success: false };
      }
    })();
    
    // 等待所有价格查询完成
    const results = await Promise.all([dexPromise, cexPromise, jupiterPromise]);
    const pricesAcrossDexes = results[0];
    const pricesAcrossCexes = results[1];
    const jupiterResult = results[2];
    
    // 如果Jupiter查询成功，将其添加到价格列表中
    if (jupiterResult.success && jupiterResult.price !== undefined) {
      pricesAcrossDexes.push({
        dex: 'jupiter',
        chain: 'jupiter_aggregator', // 独立分类
        success: true,
        price: jupiterResult.price.toString()
      });
    }
    
    // 将CEX价格添加到结果中
    for (const cexResult of pricesAcrossCexes) {
      if (cexResult.success && cexResult.price !== undefined) {
        pricesAcrossDexes.push({
          dex: cexResult.exchange,
          chain: 'centralized', // 中心化交易所
          success: true,
          price: cexResult.price.toString()
        });
      }
    }
    
    if (pricesAcrossDexes.length === 0) {
      await ctx.telegram.editMessageText(
        waitingMsg.chat.id,
        waitingMsg.message_id,
        undefined,
        `无法获取 ${tokenSymbol} 在任何平台上的数据`
      );
      return;
    }
    
    // 处理成功的价格数据
    const successfulPrices = pricesAcrossDexes.filter(result => result.success);
    
    // 检测价格异常值
    const priceInfos: PriceInfo[] = successfulPrices.map(result => ({
      dex: result.dex,
      chain: result.chain,
      price: parseFloat(result.price || '0'),
      isOutlier: false
    }));
    
    // 标记异常值
    detectOutliers(priceInfos);
    
    // 构建价格比较消息
    let resultMessage = `📊 *${tokenSymbol}/${baseTokenSymbol} 交易平台价格聚合*\n---------------------\n`;
    
    // 添加代币信息
    resultMessage += `*代币信息:* ${tokenInfo.name} (${tokenInfo.source === 'coingecko' ? 'coingecko' : tokenInfo.source})\n`;
    
    // 更清晰地显示支持的交易平台
    resultMessage += `*数据来源:*\n`;
    
    // 为不同链上的DEX进行分组，同时过滤掉异常值
    const jupiterDex = priceInfos.filter(p => p.chain === 'jupiter_aggregator');
    const ethereumDexes = priceInfos.filter(p => p.chain === 'ethereum');
    const solanaDexes = priceInfos.filter(p => p.chain === 'solana');
    const bscDexes = priceInfos.filter(p => p.chain === 'bsc');
    const zkSyncDexes = priceInfos.filter(p => p.chain === 'zksync');
    const cexes = priceInfos.filter(p => p.chain === 'centralized');
    
    // Jupiter聚合器（单独分类）
    if (jupiterDex.length > 0) {
      resultMessage += `\n🔹 *Jupiter加密货币聚合器:*\n`;
      for (const jup of jupiterDex) {
        const jupName = jup.dex.charAt(0).toUpperCase() + jup.dex.slice(1);
        let priceText = formatTokenPrice(jup.price, baseTokenSymbol);
        
        // 如果是异常值，标记出来
        if (jup.isOutlier) {
          priceText += ` ⚠️`;
        }
        
        resultMessage += `  • ${jupName}: ${priceText} ${baseTokenSymbol}${jup.isOutlier ? ' (可能不准确)' : ''}\n`;
      }
    }
    
    // 以太坊链
    if (ethereumDexes.length > 0) {
      resultMessage += `\n🔹 *以太坊DEX:*\n`;
      for (const dex of ethereumDexes) {
        const dexName = dex.dex.charAt(0).toUpperCase() + dex.dex.slice(1);
        let priceText = formatTokenPrice(dex.price, baseTokenSymbol);
        
        // 如果是异常值，标记出来
        if (dex.isOutlier) {
          priceText += ` ⚠️`;
        }
        
        resultMessage += `  • ${dexName}: ${priceText} ${baseTokenSymbol}${dex.isOutlier ? ' (可能不准确)' : ''}\n`;
      }
    }
    
    // Solana链
    if (solanaDexes.length > 0) {
      resultMessage += `\n🔹 *Solana DEX:*\n`;
      for (const dex of solanaDexes) {
        const dexName = dex.dex.charAt(0).toUpperCase() + dex.dex.slice(1);
        let priceText = formatTokenPrice(dex.price, baseTokenSymbol);
        
        // 如果是异常值，标记出来
        if (dex.isOutlier) {
          priceText += ` ⚠️`;
        }
        
        resultMessage += `  • ${dexName}: ${priceText} ${baseTokenSymbol}${dex.isOutlier ? ' (可能不准确)' : ''}\n`;
      }
    }
    
    // BSC链
    if (bscDexes.length > 0) {
      resultMessage += `\n🔹 *BSC DEX:*\n`;
      for (const dex of bscDexes) {
        const dexName = dex.dex.charAt(0).toUpperCase() + dex.dex.slice(1);
        let priceText = formatTokenPrice(dex.price, baseTokenSymbol);
        
        // 如果是异常值，标记出来
        if (dex.isOutlier) {
          priceText += ` ⚠️`;
        }
        
        resultMessage += `  • ${dexName}: ${priceText} ${baseTokenSymbol}${dex.isOutlier ? ' (可能不准确)' : ''}\n`;
      }
    }
    
    // zkSync生态
    if (zkSyncDexes.length > 0) {
      resultMessage += `\n🔹 *zkSync DEX:*\n`;
      for (const dex of zkSyncDexes) {
        const dexName = dex.dex.charAt(0).toUpperCase() + dex.dex.slice(1);
        let priceText = formatTokenPrice(dex.price, baseTokenSymbol);
        
        // 如果是异常值，标记出来
        if (dex.isOutlier) {
          priceText += ` ⚠️`;
        }
        
        resultMessage += `  • ${dexName}: ${priceText} ${baseTokenSymbol}${dex.isOutlier ? ' (可能不准确)' : ''}\n`;
      }
    }
    
    // 中心化交易所
    if (cexes.length > 0) {
      resultMessage += `\n🔹 *中心化交易所(CEX):*\n`;
      for (const cex of cexes) {
        const cexName = cex.dex.charAt(0).toUpperCase() + cex.dex.slice(1);
        let priceText = formatTokenPrice(cex.price, baseTokenSymbol);
        
        // 如果是异常值，标记出来
        if (cex.isOutlier) {
          priceText += ` ⚠️`;
        }
        
        resultMessage += `  • ${cexName}: ${priceText} ${baseTokenSymbol}${cex.isOutlier ? ' (可能不准确)' : ''}\n`;
      }
    }
    
    // 如果有多个成功的价格，计算价格差异
    // 过滤掉异常值再进行比较
    const normalPrices = priceInfos.filter(p => !p.isOutlier);
    
    if (normalPrices.length > 1) {
      // 找到最高和最低价格
      let minPrice = { dex: '', price: Infinity };
      let maxPrice = { dex: '', price: 0 };
      
      for (const result of normalPrices) {
        const price = result.price;
        if (price < minPrice.price) {
          minPrice = { dex: result.dex, price };
        }
        if (price > maxPrice.price) {
          maxPrice = { dex: result.dex, price };
        }
      }
      
      // 计算价格差异百分比
      const priceDiff = maxPrice.price - minPrice.price;
      const priceDiffPct = (priceDiff / minPrice.price) * 100;
      
      resultMessage += `\n📈 *套利分析*\n`;
      resultMessage += `最低: ${minPrice.dex.charAt(0).toUpperCase() + minPrice.dex.slice(1)} (${formatTokenPrice(minPrice.price, baseTokenSymbol)} ${baseTokenSymbol})\n`;
      resultMessage += `最高: ${maxPrice.dex.charAt(0).toUpperCase() + maxPrice.dex.slice(1)} (${formatTokenPrice(maxPrice.price, baseTokenSymbol)} ${baseTokenSymbol})\n`;
      resultMessage += `差异: ${priceDiffPct.toFixed(2)}%\n`;
      
      if (priceDiffPct > 1) {
        resultMessage += `\n💰 *潜在套利机会!*\n`;
        resultMessage += `考虑在 ${minPrice.dex} 买入，在 ${maxPrice.dex} 卖出`;
      }
    } else if (priceInfos.length > 1 && normalPrices.length <= 1) {
      // 有多个价格但大部分是异常值
      resultMessage += `\n⚠️ *价格异常提示*\n`;
      resultMessage += `检测到价格数据中存在明显的不一致，已标记可能不准确的数据源。`;
      
      // 如果正常价格只有一个，显示它作为参考
      if (normalPrices.length === 1) {
        const normalPrice = normalPrices[0];
        resultMessage += `\n参考价格: ${formatTokenPrice(normalPrice.price, baseTokenSymbol)} ${baseTokenSymbol} (${normalPrice.dex})`;
      }
    } else if (normalPrices.length === 1) {
      const platform = normalPrices[0].dex.charAt(0).toUpperCase() + normalPrices[0].dex.slice(1);
      resultMessage += `\n⚠️ 目前只有 ${platform} 返回了可靠的价格数据，无法进行比较。请稍后再试，或尝试其他交易对。`;
    } else {
      resultMessage += `\n⚠️ 未获取到可靠的价格数据，请尝试其他交易对或稍后再试。`;
    }
    
    // 如果有异常值，添加说明
    const outliers = priceInfos.filter(p => p.isOutlier);
    if (outliers.length > 0) {
      resultMessage += `\n\n📝 *注意*: ⚠️ 标记的价格与大多数数据源差异较大，可能不准确。`;
    }
    
    await ctx.telegram.editMessageText(
      waitingMsg.chat.id,
      waitingMsg.message_id,
      undefined,
      resultMessage,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    const err = error as Error;
    await ctx.reply(`聚合分析时发生错误: ${err.message}`);
  }
}

/**
 * 检测价格中的异常值
 * @param prices 价格信息数组
 */
function detectOutliers(prices: PriceInfo[]): void {
  if (prices.length <= 1) {
    return; // 只有一个价格，无法判断异常
  }
  
  // 1. 优先使用可信交易所作为基准
  const trustedExchanges = ['binance', 'coinbase', 'okx', 'kraken', 'huobi', 'bybit'];
  const trustedPrices = prices.filter(p => 
    trustedExchanges.some(ex => p.dex.toLowerCase().includes(ex))
  );
  
  // 2. 如果有足够的可信交易所数据，使用它们作为参考
  if (trustedPrices.length >= 2) {
    // 计算可信交易所的平均价格
    const trustedAvg = trustedPrices.reduce((sum, p) => sum + p.price, 0) / trustedPrices.length;
    console.log(`[异常值检测] 可信交易所平均价格: ${trustedAvg}`);
    
    // 使用可信平均价格作为参考检测异常值
    for (const priceInfo of prices) {
      const deviation = Math.abs(priceInfo.price - trustedAvg) / trustedAvg;
      // 如果与可信平均价格偏差超过25%，标记为异常
      if (deviation > 0.25) {
        priceInfo.isOutlier = true;
        console.log(`[异常值检测] 价格 ${priceInfo.price} 来自 ${priceInfo.dex} 与可信平均价 ${trustedAvg} 偏差 ${(deviation * 100).toFixed(2)}%, 标记为异常`);
      }
    }
  } else {
    // 3. 如果没有足够的可信数据，使用中位数方法
    const priceValues = prices.map(p => p.price).sort((a, b) => a - b);
    const mid = Math.floor(priceValues.length / 2);
    const median = priceValues.length % 2 === 0
      ? (priceValues[mid - 1] + priceValues[mid]) / 2
      : priceValues[mid];
    
    console.log(`[异常值检测] 使用中位数方法，中位数价格: ${median}`);
    
    // 对于每个价格，检查与中位数的偏差
    for (const priceInfo of prices) {
      const deviation = Math.abs(priceInfo.price - median) / median;
      // 正常情况下，偏差超过30%标记为异常
      // 极端情况（相差100倍以上）也标记为异常
      if (deviation > 0.3 || priceInfo.price / median > 100 || median / priceInfo.price > 100) {
        priceInfo.isOutlier = true;
        console.log(`[异常值检测] 价格 ${priceInfo.price} 来自 ${priceInfo.dex} 被标记为异常值 (中位数: ${median}, 偏差: ${(deviation * 100).toFixed(2)}%)`);
      }
    }
  }
  
  // 4. 特殊处理：如果所有价格都被标记为异常，取消所有标记（避免误判）
  if (prices.every(p => p.isOutlier)) {
    console.log(`[异常值检测] 所有价格都被标记为异常，取消所有标记`);
    prices.forEach(p => p.isOutlier = false);
  }
  
  // 5. 特殊处理：如果大多数价格都是异常值，可能需要反转标记
  const outlierCount = prices.filter(p => p.isOutlier).length;
  if (outlierCount > prices.length / 2) {
    console.log(`[异常值检测] 大多数价格被标记为异常，反转标记`);
    prices.forEach(p => p.isOutlier = !p.isOutlier);
  }
} 