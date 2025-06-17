import { Telegraf, Context, Markup } from 'telegraf';
import { Message } from 'telegraf/typings/core/types/typegram';
import { config } from '../config';
import { getFearAndGreedIndex } from '../services/price';
import { formatTokenPrice } from '../services/price';
import * as commands from './commands';
import { setupMiddleware } from './middleware';

// 确保机器人token已设置
if (!config.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN 未配置，请检查 .env 文件');
}

// 创建 bot 实例
const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

// 设置中间件
setupMiddleware(bot);

// 注册命令处理函数
commands.registerCommands(bot);

// 处理 /start 命令
bot.start((ctx) => {
  return ctx.reply(
    '👋 欢迎使用 DEX 分析助手！\n\n以下是可用命令：',
    Markup.keyboard([
      ['📈 市场情绪', '💰 代币价格'],
      ['📊 Solana信息', '🔄 套利分析'],
      ['💧 流动性', '🐳 大户监控'],
      ['⚙️ 交易建议', '📝 价格提醒'],
      ['💼 钱包跟踪', '❓ 帮助']
    ]).resize()
  );
});

// 处理按钮点击
bot.hears('📈 市场情绪', (ctx) => commands.handleFearCommand(ctx));
bot.hears('💰 代币价格', (ctx) => ctx.reply('请输入 /price [代币符号] 查询价格，例如: /price btc'));
bot.hears('📊 Solana信息', (ctx) => commands.handleSolanaCommand(ctx));
bot.hears('🔄 套利分析', (ctx) => ctx.reply('请使用 /compare [代币符号] 命令查看不同平台间的价格差异，从而发现潜在套利机会。'));
bot.hears('💧 流动性', (ctx) => ctx.reply('请输入 /liquidity [代币对] [链] 分析流动性池，例如: /liquidity eth/usdc ethereum'));
bot.hears('🐳 大户监控', (ctx) => ctx.reply('请输入 /whale [数量] 监控大额交易，例如: /whale 100'));
bot.hears('⚙️ 交易建议', (ctx) => ctx.reply('请输入 /trade [代币符号] 获取交易建议，例如: /trade btc'));
bot.hears('📝 价格提醒', (ctx) => ctx.reply('请输入 /alert [代币符号] [条件] [价格] 设置价格提醒，例如: /alert btc > 50000'));
bot.hears('💼 钱包跟踪', (ctx) => ctx.reply('请输入 /track eth [地址] [名称] 跟踪钱包，例如: /track eth 0x1234... 我的钱包'));
bot.hears('❓ 帮助', (ctx) => commands.handleHelpCommand(ctx));

// 处理错误
bot.catch((err, ctx) => {
  console.error(`Bot error: ${(err as Error).message}`);
  ctx.reply(`操作过程中发生错误: ${(err as Error).message}`).catch((e) => console.error('无法发送错误消息', e));
});

// 处理未知消息
bot.on('message', (ctx) => {
  const message = ctx.message;
  // 只处理文本消息
  if (!('text' in message)) {
    return;
  }
  
  const text = message.text;
  
  // 如果消息不是命令，则提示用户
  if (!text.startsWith('/')) {
    ctx.reply('我不理解这个命令。请使用 /help 查看可用命令。');
  }
});

// 发送恐惧贪婪指数消息
export async function sendFearAndGreedMessage(chatId?: string): Promise<string | Message.TextMessage> {
  try {
    const fngData = await getFearAndGreedIndex();
    
    if (fngData.data.length === 0) {
      throw new Error('未获取到有效数据');
    }

    const current = fngData.data[0];
    const messageText = `
📈 *加密货币市场情绪报告*
---------------------
🪙 当前指数: *${current.value}*
😨😋 情绪: *${current.value_classification}*
🕒 更新时间: ${new Date(parseInt(current.timestamp) * 1000).toLocaleString()}
    `;

    // 如果指定了chatId则发送消息，否则只返回消息内容
    if (chatId) {
      return await bot.telegram.sendMessage(chatId, messageText, { parse_mode: 'Markdown' });
    }
    
    return messageText;
  } catch (error) {
    const err = error as Error;
    const errorMessage = `⚠️ 获取恐惧贪婪指数失败: ${err.message}`;
    
    if (chatId) {
      return await bot.telegram.sendMessage(chatId, errorMessage);
    }
    
    return errorMessage;
  }
}

// 处理 /fear 命令
bot.command('fear', async (ctx) => {
  await ctx.sendChatAction('typing');
  const messageText = await sendFearAndGreedMessage() as string;
  return ctx.replyWithMarkdown(messageText);
});

// 设置定时任务
function setupScheduledTasks() {
  // 这里可以添加定时任务，例如每天发送市场情绪报告等
  console.log('⏰ 定时任务已设置');
}

export { bot };

// 启动机器人
export async function startBot() {
  try {
    await bot.launch();
    console.log('🤖 Telegram 机器人已启动');
    setupScheduledTasks();
  } catch (error) {
    console.error('❌ 启动机器人失败:', (error as Error).message);
    process.exit(1);
  }
}

// 优雅地关闭
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 