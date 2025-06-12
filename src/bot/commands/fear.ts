import { Context } from 'telegraf';
import { getFearAndGreedIndex } from '../../utils/crypto/cryptoUtils';

/**
 * 处理恐惧贪婪指数查询命令
 * @param ctx Telegraf上下文
 */
export async function handleFearCommand(ctx: Context): Promise<void> {
  await ctx.sendChatAction('typing');
  
  try {
    // 提示用户正在查询
    await ctx.reply('正在获取市场恐惧贪婪指数...');
    
    const fngData = await getFearAndGreedIndex();
    
    // 全面检查返回数据结构
    if (!fngData || !fngData.data || !Array.isArray(fngData.data) || fngData.data.length === 0) {
      await ctx.reply('获取数据失败：返回的恐惧贪婪指数数据格式错误或为空');
      return;
    }
    
    const current = fngData.data[0];
    
    // 检查当前数据是否完整
    if (!current || !current.value) {
      await ctx.reply('获取数据失败：当前恐惧贪婪指数数据不完整');
      return;
    }
    
    // 安全获取历史数据，添加默认值防止undefined
    const yesterday = fngData.data.length > 1 ? fngData.data[1] : current;
    const weekAgo = fngData.data.length > 7 ? fngData.data[7] : (fngData.data.length > 6 ? fngData.data[6] : current);
    const monthAgo = fngData.data.length > 30 ? fngData.data[30] : (fngData.data.length > 1 ? fngData.data[fngData.data.length - 1] : current);
    
    // 确保所有需要的值都存在
    const currentValue = parseInt(current.value || '50');
    const yesterdayValue = parseInt(yesterday.value || '50');
    const weekAgoValue = parseInt(weekAgo.value || '50');
    const monthAgoValue = parseInt(monthAgo.value || '50');
    
    // 生成emoji表情
    let emoji = '😐';
    if (currentValue <= 20) emoji = '😱';
    else if (currentValue <= 40) emoji = '😨';
    else if (currentValue <= 60) emoji = '😐';
    else if (currentValue <= 80) emoji = '😊';
    else emoji = '🤑';
    
    // 计算趋势变化
    const dailyChange = currentValue - yesterdayValue;
    const weeklyChange = currentValue - weekAgoValue;
    const monthlyChange = currentValue - monthAgoValue;
    
    // 生成趋势符号
    const getTrendSymbol = (change: number) => {
      if (change > 10) return '🔥 急剧上升';
      if (change > 5) return '📈 上升';
      if (change > 0) return '↗️ 小幅上升';
      if (change === 0) return '➡️ 持平';
      if (change > -5) return '↘️ 小幅下降';
      if (change > -10) return '📉 下降';
      return '❄️ 急剧下降';
    };
    
    // 格式化时间戳
    const formatTimestamp = (timestamp: string) => {
      try {
        return new Date(parseInt(timestamp) * 1000).toLocaleString();
      } catch (e) {
        return new Date().toLocaleString() + ' (预估)';
      }
    };
    
    const message = `
📊 *加密市场恐惧与贪婪指数* ${emoji}
-------------------------
📌 当前指数: *${current.value}* (${current.value_classification || '未知分类'})
🕒 更新时间: ${formatTimestamp(current.timestamp)}

📋 *趋势分析:*
⏱️ 日变化: ${dailyChange > 0 ? '+' : ''}${dailyChange} ${getTrendSymbol(dailyChange)}
📅 周变化: ${weeklyChange > 0 ? '+' : ''}${weeklyChange} ${getTrendSymbol(weeklyChange)}
📆 月变化: ${monthlyChange > 0 ? '+' : ''}${monthlyChange} ${getTrendSymbol(monthlyChange)}

💡 *解读:*
${getMarketInterpretation(currentValue)}
    `;
    
    await ctx.replyWithMarkdown(message);
  } catch (error) {
    const err = error as Error;
    await ctx.reply(`获取恐惧贪婪指数失败: ${err.message}\n可能是API暂时不可用，请稍后再试。`);
  }
}

/**
 * 根据恐惧贪婪指数值提供市场解读
 * @param value 指数值
 * @returns 市场解读文本
 */
function getMarketInterpretation(value: number): string {
  if (value <= 20) {
    return '市场处于极度恐惧状态，通常表明投资者过度悲观，可能是买入机会。历史上这个区间往往是积累筹码的良好时机。';
  } else if (value <= 40) {
    return '市场处于恐惧状态，投资者情绪偏向悲观。这可能是开始逐步买入的时机，但需要保持谨慎。';
  } else if (value <= 60) {
    return '市场处于中性状态，投资者情绪相对平衡。这个阶段适合保持现有仓位，观察市场动向再做决策。';
  } else if (value <= 80) {
    return '市场处于贪婪状态，投资者情绪偏向乐观。可能需要保持谨慎，考虑逐步减仓或对冲风险。';
  } else {
    return '市场处于极度贪婪状态，投资者过度乐观，可能是泡沫区域。历史上这个区间往往出现较大回调，建议控制仓位，提高风险意识。';
  }
} 