import { Context } from 'telegraf';
import { getTokenBySymbol } from '../../config/tokens';
import { getCryptoPrice } from '../../services/price';

// 价格提醒类型
type AlertType = 'above' | 'below';

// 价格提醒接口
interface PriceAlert {
  id: string;
  userId: number;
  tokenSymbol: string;
  targetPrice: number;
  type: AlertType;
  createdAt: Date;
  active: boolean;
}

// 存储用户设置的价格提醒 (实际应用应使用数据库存储)
const priceAlerts: PriceAlert[] = [];

// 生成唯一提醒ID
function generateAlertId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/**
 * 处理价格提醒命令
 * @param ctx Telegraf上下文
 */
export async function handleAlertCommand(ctx: Context): Promise<void> {
  await ctx.sendChatAction('typing');
  
  const message = ctx.message;
  // 确保消息是文本消息
  if (!message || !('text' in message)) {
    await ctx.reply('无法处理此类消息');
    return;
  }
  
  // 解析命令参数
  const args = message.text.split(' ').filter(arg => arg.trim() !== '');
  
  // 处理命令选项
  if (args.length === 1 || args[1] === 'help') {
    await ctx.replyWithMarkdown(
      `*价格提醒设置*\n\n` +
      `设置价格提醒: /alert [代币符号] [条件] [价格]\n` +
      `例如: /alert BTC > 50000\n` +
      `或: /alert ETH < 2000\n\n` +
      `查看当前提醒: /alert list\n` +
      `删除提醒: /alert delete [提醒ID]\n` +
      `取消所有提醒: /alert clear`
    );
    return;
  }
  
  // 列出当前用户的所有提醒
  if (args[1] === 'list') {
    return listUserAlerts(ctx);
  }
  
  // 删除特定提醒
  if (args[1] === 'delete' && args.length > 2) {
    return deleteAlert(ctx, args[2]);
  }
  
  // 清除当前用户的所有提醒
  if (args[1] === 'clear') {
    return clearUserAlerts(ctx);
  }
  
  // 创建新提醒
  if (args.length >= 4) {
    const tokenSymbol = args[1].toUpperCase();
    const condition = args[2];
    const targetPrice = parseFloat(args[3]);
    
    // 验证输入
    if (isNaN(targetPrice) || targetPrice <= 0) {
      await ctx.reply('无效的价格，请输入大于0的数值');
      return;
    }
    
    if (condition !== '>' && condition !== '<') {
      await ctx.reply('无效的条件，请使用 > (高于) 或 < (低于)');
      return;
    }
    
    const type: AlertType = condition === '>' ? 'above' : 'below';
    
    // 检查代币是否存在
    try {
      // 尝试获取当前价格以验证代币存在
      const priceData = await getCryptoPrice(tokenSymbol.toLowerCase());
      const currentPrice = priceData.market_data.current_price.usd;
      
      // 创建提醒
      const alertId = generateAlertId();
      const userId = ctx.from?.id || 0;
      
      priceAlerts.push({
        id: alertId,
        userId,
        tokenSymbol,
        targetPrice,
        type,
        createdAt: new Date(),
        active: true
      });
      
      await ctx.replyWithMarkdown(
        `✅ *价格提醒已设置*\n` +
        `---------------------\n` +
        `🔔 提醒ID: \`${alertId}\`\n` +
        `💰 代币: ${tokenSymbol}\n` +
        `📊 条件: ${type === 'above' ? '高于' : '低于'} $${targetPrice.toFixed(2)}\n` +
        `📈 当前价格: $${currentPrice.toFixed(2)}\n\n` +
        `_当价格${type === 'above' ? '上升至' : '下跌至'}目标值时，您将收到通知_\n` +
        `_使用 /alert delete ${alertId} 可删除此提醒_`
      );
      
      // 在实际应用中，这里会启动一个检查价格的后台任务
      // 这里只是模拟
      setTimeout(() => {
        simulateAlertCheck(ctx, alertId);
      }, 10000); // 10秒后模拟检查
      
    } catch (error) {
      const err = error as Error;
      await ctx.reply(`设置价格提醒失败: ${err.message}`);
    }
  } else {
    await ctx.reply('参数不足。正确格式: /alert [代币符号] [条件] [价格]');
  }
}

/**
 * 列出用户的所有提醒
 * @param ctx Telegraf上下文
 */
async function listUserAlerts(ctx: Context): Promise<void> {
  const userId = ctx.from?.id || 0;
  const userAlerts = priceAlerts.filter(alert => alert.userId === userId && alert.active);
  
  if (userAlerts.length === 0) {
    await ctx.reply('您当前没有设置任何价格提醒');
    return;
  }
  
  let message = `*您的价格提醒列表*\n---------------------\n`;
  
  for (const alert of userAlerts) {
    message += `🔔 ID: \`${alert.id}\`\n`;
    message += `💰 ${alert.tokenSymbol} ${alert.type === 'above' ? '>' : '<'} $${alert.targetPrice.toFixed(2)}\n`;
    message += `🕒 设置于: ${alert.createdAt.toLocaleString()}\n`;
    message += `---------------------\n`;
  }
  
  message += `\n_使用 /alert delete [ID] 删除特定提醒_\n`;
  message += `_使用 /alert clear 清除所有提醒_`;
  
  await ctx.replyWithMarkdown(message);
}

/**
 * 删除特定提醒
 * @param ctx Telegraf上下文
 * @param alertId 提醒ID
 */
async function deleteAlert(ctx: Context, alertId: string): Promise<void> {
  const userId = ctx.from?.id || 0;
  
  const alertIndex = priceAlerts.findIndex(alert => 
    alert.id === alertId && alert.userId === userId && alert.active
  );
  
  if (alertIndex === -1) {
    await ctx.reply('未找到该提醒，或者它已被删除');
    return;
  }
  
  // 设置为非活动状态
  priceAlerts[alertIndex].active = false;
  
  await ctx.replyWithMarkdown(
    `✅ 已删除 ${priceAlerts[alertIndex].tokenSymbol} 的价格提醒`
  );
}

/**
 * 清除用户的所有提醒
 * @param ctx Telegraf上下文
 */
async function clearUserAlerts(ctx: Context): Promise<void> {
  const userId = ctx.from?.id || 0;
  
  const userAlertCount = priceAlerts.filter(alert => 
    alert.userId === userId && alert.active
  ).length;
  
  if (userAlertCount === 0) {
    await ctx.reply('您当前没有任何价格提醒');
    return;
  }
  
  // 设置所有用户提醒为非活动状态
  for (const alert of priceAlerts) {
    if (alert.userId === userId && alert.active) {
      alert.active = false;
    }
  }
  
  await ctx.replyWithMarkdown(
    `✅ 已清除所有 ${userAlertCount} 个价格提醒`
  );
}

/**
 * 模拟检查价格提醒 (在实际应用中，会有单独的任务定期检查所有活跃提醒)
 * @param ctx Telegraf上下文
 * @param alertId 提醒ID
 */
async function simulateAlertCheck(ctx: Context, alertId: string): Promise<void> {
  const alertIndex = priceAlerts.findIndex(alert => alert.id === alertId && alert.active);
  
  if (alertIndex === -1) {
    return; // 提醒已被删除或不存在
  }
  
  const alert = priceAlerts[alertIndex];
  
  try {
    // 获取实时价格
    const priceData = await getCryptoPrice(alert.tokenSymbol.toLowerCase());
    const currentPrice = priceData.market_data.current_price.usd;
    
    // 检查价格条件是否满足
    let conditionMet = false;
    if (alert.type === 'above' && currentPrice >= alert.targetPrice) {
      conditionMet = true;
    } else if (alert.type === 'below' && currentPrice <= alert.targetPrice) {
      conditionMet = true;
    }
    
    // 如果条件满足，发送通知
    if (conditionMet) {
      await ctx.telegram.sendMessage(
        alert.userId,
        `🚨 *价格提醒触发*\n` +
        `---------------------\n` +
        `💰 ${alert.tokenSymbol} 已${alert.type === 'above' ? '上升至' : '下跌至'} $${currentPrice.toFixed(2)}\n` +
        `🎯 目标价: $${alert.targetPrice.toFixed(2)}\n\n` +
        `_此提醒将被自动删除_`,
        { parse_mode: 'Markdown' }
      );
      
      // 设置提醒为非活动状态
      priceAlerts[alertIndex].active = false;
    }
  } catch (error) {
    console.error(`检查价格提醒失败 (ID: ${alertId}):`, error);
  }
}