import { Context } from 'telegraf';
import { getTokenBySymbol } from '../../config/tokens';

// 简易订单存储 (实际应用中应使用持久化存储)
interface Order {
  id: string;
  userId: number;
  type: 'buy' | 'sell' | 'limit';
  tokenPair: string;
  amount: number;
  price?: number;
  status: 'pending' | 'executed' | 'cancelled';
  createdAt: Date;
}

const orders: Order[] = [];

// 生成唯一订单ID
function generateOrderId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/**
 * 处理交易命令
 * @param ctx Telegraf上下文
 */
export async function handleTradeCommand(ctx: Context): Promise<void> {
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
      `*智能交易系统*\n\n` +
      `请使用以下格式:\n` +
      `- 市价单: /trade [买/卖] [代币对] [数量]\n` + 
      `  例如: /trade 买 ETH/USDC 0.5\n\n` +
      `- 限价单: /trade limit [代币对] [价格] [数量]\n` +
      `  例如: /trade limit ETH/USDC 1800 0.5\n\n` +
      `可用于取消订单: /trade cancel [订单ID]`
    );
    return;
  }
  
  if (args[1].toLowerCase() === 'cancel') {
    return handleCancelOrder(ctx, args[2]);
  }

  if (args[1].toLowerCase() === 'limit') {
    return handleLimitOrder(ctx, args);
  }
  
  return handleMarketOrder(ctx, args);
}

/**
 * 处理市价单
 * @param ctx Telegraf上下文
 * @param args 命令参数
 */
async function handleMarketOrder(ctx: Context, args: string[]): Promise<void> {
  if (args.length < 4) {
    await ctx.reply('参数不足。使用格式: /trade [买/卖] [代币对] [数量]');
    return;
  }

  const action = args[1] === '买' ? 'buy' : 'sell';
  const tokenPair = args[2].toUpperCase();
  const amount = parseFloat(args[3]);

  if (isNaN(amount) || amount <= 0) {
    await ctx.reply('无效的数量，请输入大于0的数值');
    return;
  }

  // 验证代币对
  const [baseToken, quoteToken] = tokenPair.split('/');
  if (!baseToken || !quoteToken) {
    await ctx.reply('无效的代币对格式。请使用如 ETH/USDC 的格式');
    return;
  }

  // 检查代币是否存在
  const baseTokenInfo = getTokenBySymbol(baseToken, 'ethereum') || getTokenBySymbol(baseToken, 'solana');
  const quoteTokenInfo = getTokenBySymbol(quoteToken, 'ethereum') || getTokenBySymbol(quoteToken, 'solana');

  if (!baseTokenInfo || !quoteTokenInfo) {
    await ctx.reply(`找不到代币信息: ${!baseTokenInfo ? baseToken : quoteToken}`);
    return;
  }

  // 创建订单
  const orderId = generateOrderId();
  const newOrder: Order = {
    id: orderId,
    userId: ctx.from?.id || 0,
    type: action as 'buy' | 'sell',
    tokenPair,
    amount,
    status: 'pending',
    createdAt: new Date()
  };

  orders.push(newOrder);

  // 在实际应用中，这里会连接到DEX进行交易
  // 现在只是模拟
  await ctx.replyWithMarkdown(
    `🔄 *市价${action === 'buy' ? '买入' : '卖出'}订单已创建*\n` +
    `---------------------\n` +
    `🔢 订单ID: \`${orderId}\`\n` +
    `💱 代币对: ${tokenPair}\n` +
    `💰 数量: ${amount} ${baseToken}\n` +
    `📊 状态: 待处理\n\n` +
    `_在实际应用中，这将连接到DEX进行交易_\n` +
    `_使用 /trade cancel ${orderId} 可取消此订单_`
  );
}

/**
 * 处理限价单
 * @param ctx Telegraf上下文
 * @param args 命令参数
 */
async function handleLimitOrder(ctx: Context, args: string[]): Promise<void> {
  if (args.length < 5) {
    await ctx.reply('参数不足。使用格式: /trade limit [代币对] [价格] [数量]');
    return;
  }

  const tokenPair = args[2].toUpperCase();
  const price = parseFloat(args[3]);
  const amount = parseFloat(args[4]);

  if (isNaN(price) || price <= 0) {
    await ctx.reply('无效的价格，请输入大于0的数值');
    return;
  }

  if (isNaN(amount) || amount <= 0) {
    await ctx.reply('无效的数量，请输入大于0的数值');
    return;
  }

  // 验证代币对
  const [baseToken, quoteToken] = tokenPair.split('/');
  if (!baseToken || !quoteToken) {
    await ctx.reply('无效的代币对格式。请使用如 ETH/USDC 的格式');
    return;
  }

  // 检查代币是否存在
  const baseTokenInfo = getTokenBySymbol(baseToken, 'ethereum') || getTokenBySymbol(baseToken, 'solana');
  const quoteTokenInfo = getTokenBySymbol(quoteToken, 'ethereum') || getTokenBySymbol(quoteToken, 'solana');

  if (!baseTokenInfo || !quoteTokenInfo) {
    await ctx.reply(`找不到代币信息: ${!baseTokenInfo ? baseToken : quoteToken}`);
    return;
  }

  // 创建限价单
  const orderId = generateOrderId();
  const newOrder: Order = {
    id: orderId,
    userId: ctx.from?.id || 0,
    type: 'limit',
    tokenPair,
    amount,
    price,
    status: 'pending',
    createdAt: new Date()
  };

  orders.push(newOrder);

  // 在实际应用中，这里会连接到DEX设置限价单
  await ctx.replyWithMarkdown(
    `⏳ *限价单已创建*\n` +
    `---------------------\n` +
    `🔢 订单ID: \`${orderId}\`\n` +
    `💱 代币对: ${tokenPair}\n` +
    `💲 价格: ${price} ${quoteToken}\n` +
    `💰 数量: ${amount} ${baseToken}\n` +
    `💵 总值: ${(price * amount).toFixed(2)} ${quoteToken}\n` +
    `📊 状态: 待处理\n\n` +
    `_在实际应用中，价格达到设定值时会自动执行交易_\n` +
    `_使用 /trade cancel ${orderId} 可取消此订单_`
  );
}

/**
 * 处理取消订单
 * @param ctx Telegraf上下文
 * @param orderId 订单ID
 */
async function handleCancelOrder(ctx: Context, orderId: string): Promise<void> {
  if (!orderId) {
    await ctx.reply('请提供要取消的订单ID');
    return;
  }

  const orderIndex = orders.findIndex(order => 
    order.id === orderId && order.userId === ctx.from?.id
  );

  if (orderIndex === -1) {
    await ctx.reply(`找不到ID为 ${orderId} 的订单，或者您无权取消该订单`);
    return;
  }

  // 设置订单状态为已取消
  orders[orderIndex].status = 'cancelled';

  await ctx.replyWithMarkdown(
    `✅ *订单已取消*\n` +
    `---------------------\n` +
    `🔢 订单ID: \`${orderId}\`\n` +
    `💱 代币对: ${orders[orderIndex].tokenPair}\n` +
    `📊 状态: 已取消`
  );
}

/**
 * 处理限价命令的别名
 * @param ctx Telegraf上下文
 */
export async function handleLimitCommand(ctx: Context): Promise<void> {
  const message = ctx.message;
  if (!message || !('text' in message)) {
    await ctx.reply('无法处理此类消息');
    return;
  }

  // 将/limit命令转换为/trade limit格式处理
  const text = message.text;
  const args = text.split(' ');
  args[0] = '/trade';
  args.splice(1, 0, 'limit');

  // 修改消息上下文后调用handleTradeCommand
  const modifiedMessage = { ...message, text: args.join(' ') };
  await handleTradeCommand({ ...ctx, message: modifiedMessage } as Context);
} 