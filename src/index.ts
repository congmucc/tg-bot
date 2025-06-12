import { Telegraf, Context, Markup } from 'telegraf';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { message } from 'telegraf/filters';
import { registerCommands, handleFearCommand, handleSolanaCommand } from './bot/commands';
import { getCryptoPrice, getFearAndGreedIndex } from './services/price';
import jupiterApi from './api/jupiterApi';

dotenv.config();

// 检查环境变量
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('错误: 请在.env文件中设置TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

// 创建机器人实例
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// 注册所有命令
registerCommands(bot);

// 处理 /start 命令
bot.start((ctx) => {
  return ctx.reply(
    '👋 欢迎使用加密货币分析助手！\n\n以下是可用命令：',
    Markup.keyboard([
      ['📈 市场情绪', '💰 代币价格'],
      ['📊 Solana信息', '🔄 套利分析'],
      ['💧 流动性', '🐳 大户监控'],
      ['❓ 帮助']
    ]).resize()
  );
});

// 处理 /help 命令
bot.command('help', (ctx) => {
  return ctx.reply(
    '*加密货币分析助手使用指南*\n\n' +
    '此机器人可以帮助您分析加密货币市场，监控价格和交易机会。\n\n' +
    '*可用命令：*\n' +
    '- /fear - 查看恐惧贪婪指数\n' +
    '- /price [代币符号] - 查询代币价格\n' +
    '- /solana - 查看Solana网络状态\n' +
    '- /compare [代币符号] - 交易平台价格聚合(DEX+CEX)\n' +
    '- /liquidity [LP地址] [链] - 查询流动性池\n' +
    '- /whale [数量] - 监控大额转账\n' +
    '- /help - 显示帮助信息',
    { parse_mode: 'Markdown' }
  );
});

// 处理文本按钮
bot.hears('📈 市场情绪', async (ctx) => {
  // 调用fear命令的处理函数
  await handleFearCommand(ctx);
});

bot.hears('📊 Solana信息', async (ctx) => {
  // 调用solana命令的处理函数
  await handleSolanaCommand(ctx);
});

bot.hears('💰 代币价格', (ctx) => {
  ctx.reply('请输入代币符号，例如: /price BTC');
});

bot.hears('🔄 套利分析', (ctx) => {
  ctx.reply('请使用 /compare [代币符号] 命令查看不同平台间的价格差异，从而发现潜在套利机会。');
});

bot.hears('💧 流动性', (ctx) => {
  ctx.reply('请输入LP地址和链名称，例如: /liquidity <address> eth');
});

bot.hears('🐳 大户监控', (ctx) => {
  ctx.reply('请输入监控金额阈值，例如: /whale 100');
});

bot.hears('❓ 帮助', (ctx) => {
  return ctx.reply(
    '*加密货币分析助手使用指南*\n\n' +
    '此机器人可以帮助您分析加密货币市场，监控价格和交易机会。\n\n' +
    '*可用命令：*\n' +
    '- /fear - 查看恐惧贪婪指数\n' +
    '- /price [代币符号] - 查询代币价格\n' +
    '- /solana - 查看Solana网络状态\n' +
    '- /compare [代币符号] - 交易平台价格聚合(DEX+CEX)\n' +
    '- /liquidity [LP地址] [链] - 查询流动性池\n' +
    '- /whale [数量] - 监控大额转账\n' +
    '- /help - 显示帮助信息',
    { parse_mode: 'Markdown' }
  );
});

// 处理未知命令
bot.on(message('text'), (ctx) => {
  ctx.reply('我不理解这个命令。请使用 /help 查看可用命令。');
});

// 设置定时任务 - 每天19:00发送恐惧贪婪指数
cron.schedule('0 19 * * *', async () => {
  try {
    const channelId = process.env.TELEGRAM_CHAT_ID;
    if (!channelId) {
      console.error('未设置TELEGRAM_CHAT_ID，无法发送定时消息');
      return;
    }
    
    const fngData = await getFearAndGreedIndex();
    
    if (!fngData || !fngData.data || fngData.data.length === 0) {
      console.error('无法获取恐惧贪婪指数数据');
      return;
    }

    const current = fngData.data[0];
    let message = `
📈 *每日市场情绪报告*
---------------------
🪙 当前指数: *${current.value}*
😨😋 情绪: *${current.value_classification}*
🕒 更新时间: ${new Date(parseInt(current.timestamp) * 1000).toLocaleString()}
    `;
    
    // 添加主要加密货币价格
    try {
      const btcData = await getCryptoPrice('btc');
      const ethData = await getCryptoPrice('eth');
      const solData = await getCryptoPrice('sol');
      
      message += `\n\n💰 *主要加密货币价格*
---------------------
BTC: $${btcData.market_data.current_price.usd.toFixed(2)} (${btcData.market_data.price_change_percentage_24h.toFixed(2)}%)
ETH: $${ethData.market_data.current_price.usd.toFixed(2)} (${ethData.market_data.price_change_percentage_24h.toFixed(2)}%)
SOL: $${solData.market_data.current_price.usd.toFixed(2)} (${solData.market_data.price_change_percentage_24h.toFixed(2)}%)
      `;
    } catch (error) {
      console.error('获取价格数据失败', error);
    }
    
    await bot.telegram.sendMessage(channelId, message, { parse_mode: 'Markdown' });
    console.log('定时发送市场情绪报告成功');
  } catch (error) {
    console.error('定时任务执行失败:', error);
  }
});

async function fetchPrice() {
  // 使用Jupiter API获取SOL/USDC价格
  try {
    const solPrice = await jupiterApi.getTokenPrice('SOL', 'USDC');
    console.log('SOL/USDC 价格:', solPrice);
    
    const wifPrice = await jupiterApi.getTokenPrice('WIF', 'USDC');
    console.log('WIF/USDC 价格:', wifPrice);
  } catch (error) {
    console.error('获取价格失败:', error);
  }
}

// 主函数
async function main() {
  // 测试价格获取
  // await fetchPrice();
  
  // 启动机器人
  bot.launch().then(() => {
    console.log('机器人已成功启动！');
  }).catch(error => {
    console.error('机器人启动失败:', error);
  });
  
  // 优雅地关闭
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// 启动程序
main().catch(error => {
  console.error('程序执行错误:', error);
  process.exit(1);
}); 