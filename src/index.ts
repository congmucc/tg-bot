import { Telegraf, Context, Markup } from 'telegraf';
import cron from 'node-cron';
import { message } from 'telegraf/filters';
import { registerCommands, handleFearCommand } from './bot/commands';
import { getCryptoPrice, getFearAndGreedIndex } from './services/price';
import { API_CONFIG, BOT_CONFIG } from './config/env';
import { formatAmount, shortenAddress } from './utils/format';
import { monitorLargeTransactions } from './api/blockchain';
import { initWhaleMonitor, sendWhaleAlert, startWhaleMonitoring, stopWhaleMonitoring, cleanupMonitor } from './services/whaleMonitor';
import websocketMonitor from './services/websocketMonitor';
import http from 'http';
import axios from 'axios';

// 检查环境变量
if (!BOT_CONFIG.TELEGRAM_BOT_TOKEN) {
  console.error('错误: 请在.env文件中设置TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

// 创建机器人实例
const bot = new Telegraf(BOT_CONFIG.TELEGRAM_BOT_TOKEN);

// 添加Telegram API错误处理
bot.catch((err, ctx) => {
  const error = err as Error;
  console.error(`Telegram API错误: ${error.message}`);
  
  // 处理429错误
  if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
    const match = error.message.match(/retry after (\d+)/i);
    if (match && match[1]) {
      const retryAfter = parseInt(match[1], 10);
      console.log(`收到Telegram API限流，将在${retryAfter}秒后重试`);
    }
  }
});

// 注册所有命令
registerCommands(bot);

// 处理 /start 命令
bot.start((ctx) => {
  return ctx.reply(
    '👋 欢迎使用鲸鱼监控机器人！\n\n🚀 WebSocket实时监控多链大额交易\n\n以下是可用功能：',
    Markup.keyboard([
      ['📈 市场情绪', '💰 代币价格'],
      ['🐳 鲸鱼监控', '💧 流动性'],
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



bot.hears('💰 代币价格', (ctx) => {
  ctx.reply('请输入代币符号，例如: /price BTC');
});

bot.hears('🔄 套利分析', (ctx) => {
  ctx.reply('请使用 /compare [代币符号] 命令查看不同平台间的价格差异，从而发现潜在套利机会。');
});

bot.hears('💧 流动性', (ctx) => {
  ctx.reply('请输入LP地址和链名称，例如: /liquidity <address> eth');
});

bot.hears('🐳 鲸鱼监控', async (ctx) => {
  const status = websocketMonitor.getStatus();
  const statusText = status.active ? '🟢 运行中' : '🔴 已停止';
  const connections = Object.entries(status.connections)
    .map(([chain, conn]) => `${chain}: ${conn === 'connected' ? '🟢' : '🔴'}`)
    .join('\n');

  await ctx.reply(
    `🐳 *鲸鱼监控状态*\n\n` +
    `状态: ${statusText}\n\n` +
    `连接状态:\n${connections}\n\n` +
    `监控阈值:\n` +
    `• 以太坊: ≥1 ETH\n` +
    `• Solana: ≥10 SOL\n` +
    `• 比特币: ≥0.1 BTC\n` +
    `• Hyperliquid: ≥$1,000\n\n` +
    `使用 /whale 命令查看更多选项`,
    { parse_mode: 'Markdown' }
  );
});

bot.hears('❓ 帮助', (ctx) => {
  return ctx.reply(
    '*加密货币分析助手使用指南*\n\n' +
    '此机器人可以帮助您分析加密货币市场，监控价格和交易机会。\n\n' +
    '*可用命令：*\n' +
    '- /fear - 查看恐惧贪婪指数\n' +
    '- /price [代币符号] - 查询代币价格\n' +

    '- /compare [代币符号] - 交易平台价格聚合(DEX+CEX)\n' +
    '- /liquidity [LP地址] [链] - 查询流动性池\n' +
    '- /whale [数量] - 监控大额转账\n' +
    '- /help - 显示帮助信息',
    { parse_mode: 'Markdown' }
  );
});

// 处理内联键盘回调
bot.action('whale_start', async (ctx) => {
  await ctx.answerCbQuery('正在启动监听...');
  const success = await websocketMonitor.startMonitoring();
  if (success) {
    await ctx.reply(
      '🚀 *WebSocket鲸鱼监听已启动*\n\n' +
      '💎 将实时监控以下链的大额交易:\n' +
      '🔵 以太坊: ≥50 ETH (~$125K)\n' +
      '🟣 Solana: ≥500 SOL (~$75K)\n' +
      '🟡 比特币: ≥5 BTC (~$325K)\n' +
      '🟠 Hyperliquid: ≥$50,000\n\n' +
      '✅ *监听状态: 运行中*',
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply('⚠️ *WebSocket监听已在运行中*', { parse_mode: 'Markdown' });
  }
});

bot.action('whale_stop', async (ctx) => {
  await ctx.answerCbQuery('正在停止监听...');
  const success = websocketMonitor.stopMonitoring();
  if (success) {
    await ctx.reply(
      '🛑 *WebSocket鲸鱼监听已停止*\n\n' +
      '💤 所有链的监听已关闭:\n' +
      '🔵 以太坊监听 - 已停止\n' +
      '🟣 Solana监听 - 已停止\n' +
      '🟡 比特币监听 - 已停止\n' +
      '🟠 Hyperliquid监听 - 已停止\n\n' +
      '❌ *监听状态: 已停止*',
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply('⚠️ *WebSocket监听未在运行*', { parse_mode: 'Markdown' });
  }
});

bot.action('whale_status', async (ctx) => {
  await ctx.answerCbQuery('正在获取状态...');
  const status = websocketMonitor.getStatus();
  const statusText = status.active ? '🟢 运行中' : '🔴 已停止';

  // 格式化连接状态
  const connectionStatus = {
    solana: status.connections.solana === 'connected' ? '🟢 已连接' : '🔴 未连接',
    ethereum: status.connections.ethereum === 'connected' ? '🟢 已连接' : '🔴 未连接',
    hyperliquid: status.connections.hyperliquid === 'connected' ? '🟢 已连接' : '🔴 未连接',
    bitcoin: status.connections.bitcoin === 'connected' ? '🟢 已连接' : '🔴 未连接'
  };

  await ctx.reply(
    `📊 *WebSocket鲸鱼监听状态报告*\n\n` +
    `🔄 总体状态: ${statusText}\n\n` +
    `📡 *连接状态:*\n` +
    `🔵 以太坊: ${connectionStatus.ethereum}\n` +
    `🟣 Solana: ${connectionStatus.solana}\n` +
    `🟡 比特币: ${connectionStatus.bitcoin}\n` +
    `🟠 Hyperliquid: ${connectionStatus.hyperliquid}\n\n` +
    `💎 *大额交易监控阈值:*\n` +
    `🔵 以太坊: ≥50 ETH (~$125K)\n` +
    `🟣 Solana: ≥500 SOL (~$75K)\n` +
    `🟡 比特币: ≥5 BTC (~$325K)\n` +
    `🟠 Hyperliquid: ≥$50,000\n\n` +
    `⏰ 更新时间: ${new Date().toLocaleString()}`,
    { parse_mode: 'Markdown' }
  );
});

// 处理未知命令
bot.on(message('text'), (ctx) => {
  ctx.reply('我不理解这个命令。请使用 /help 查看可用命令。');
});

// 定时任务管理
const taskLocks = new Map<string, {
  isRunning: boolean,
  lastRun: number
}>();

/**
 * 获取任务锁，防止重复执行
 * @param taskId 任务ID
 * @param cooldownMs 冷却时间(毫秒)
 * @returns 是否可以执行任务
 */
function acquireTaskLock(taskId: string, cooldownMs = 60000): boolean {
  const now = Date.now();
  const lock = taskLocks.get(taskId) || { isRunning: false, lastRun: 0 };
  
  // 如果任务正在运行或者在冷却期内，不允许执行
  if (lock.isRunning || (now - lock.lastRun < cooldownMs)) {
    console.log(`任务 ${taskId} 已在运行或在冷却期内，跳过执行`);
    return false;
  }
  
  // 获取锁
  lock.isRunning = true;
  taskLocks.set(taskId, lock);
  return true;
}

/**
 * 释放任务锁
 * @param taskId 任务ID
 */
function releaseTaskLock(taskId: string): void {
  const lock = taskLocks.get(taskId);
  if (lock) {
    lock.isRunning = false;
    lock.lastRun = Date.now();
    taskLocks.set(taskId, lock);
  }
}

// 跟踪最后一次消息发送时间 (仅用于定时任务)
let lastScheduledMessageTime = 0;
const SCHEDULED_MESSAGE_COOLDOWN_MS = 5 * 60 * 1000; // 5分钟冷却时间，仅用于定时任务

/**
 * 安全发送消息，支持@username和数字ID
 * @param chatId 聊天ID (支持@username或数字ID)
 * @param message 消息内容
 * @param options 消息选项
 * @param isScheduled 是否为定时任务消息
 * @returns 发送结果
 */
async function safeSendMessage(chatId: string, message: string, options?: any, isScheduled: boolean = false): Promise<boolean> {
  try {
    // 只对定时任务检查冷却期
    if (isScheduled) {
      const now = Date.now();
      if (now - lastScheduledMessageTime < SCHEDULED_MESSAGE_COOLDOWN_MS) {
        console.log(`定时消息发送冷却中，还需等待 ${((SCHEDULED_MESSAGE_COOLDOWN_MS - (now - lastScheduledMessageTime)) / 1000).toFixed(1)} 秒`);
        return false;
      }
    }

    await bot.telegram.sendMessage(chatId, message, options);

    if (isScheduled) {
      lastScheduledMessageTime = Date.now();
    }

    return true;
  } catch (error) {
    const err = error as Error;
    console.error(`发送消息失败: ${err.message}`);

    // 处理429错误
    if (err.message.includes('429') || err.message.includes('Too Many Requests')) {
      const match = err.message.match(/retry after (\d+)/i);
      if (match && match[1]) {
        const retryAfter = parseInt(match[1], 10) * 1000;
        console.log(`收到Telegram API限流，将在${retryAfter/1000}秒后重试`);

        // 延迟重试
        setTimeout(async () => {
          try {
            await bot.telegram.sendMessage(chatId, message, options);
            console.log('重试发送消息成功');
          } catch (retryError) {
            console.error('重试发送消息失败:', retryError);
          }
        }, retryAfter);
      }
    }

    return false;
  }
}

// 设置定时任务 - 每天19:00发送恐惧贪婪指数
cron.schedule('0 19 * * *', async () => {
  const taskId = 'daily-fear-greed-report';
  
  // 获取任务锁
  if (!acquireTaskLock(taskId, 12 * 60 * 60 * 1000)) { // 12小时冷却
    return;
  }
  
  try {
    const channelId = BOT_CONFIG.TELEGRAM_CHAT_ID;
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
    
    // 安全发送消息 (标记为定时任务)
    const sent = await safeSendMessage(channelId, message, { parse_mode: 'Markdown' }, true);
    if (sent) {
      console.log('定时发送市场情绪报告成功');
    }
  } catch (error) {
    console.error('定时任务执行失败:', error);
  } finally {
    // 释放任务锁
    releaseTaskLock(taskId);
  }
});

// 重复的监控逻辑已移除，使用whaleMonitor服务

// 使用whaleMonitor服务中的监控功能

// 创建HTTP服务器
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  res.setHeader('Content-Type', 'application/json');
  
  try {
    if (url.pathname === '/trigger-whale-monitor') {
      // 触发大额交易监控
      const channelId = BOT_CONFIG.TELEGRAM_CHAT_ID;
      if (channelId) {
        const result = await sendWhaleAlert(channelId);
        res.end(JSON.stringify({ success: result, message: result ? '监控完成' : '监控失败' }));
      } else {
        res.end(JSON.stringify({ success: false, message: '未配置TELEGRAM_CHAT_ID' }));
      }
    } else if (url.pathname === '/status') {
      // 返回服务状态
      res.end(JSON.stringify({
        success: true,
        status: 'running',
        message: '服务正在运行中'
      }));
    // 注释掉轮询监控端点
    // } else if (url.pathname === '/start-monitor') {
    //   // 启动自动监控
    //   const result = startWhaleMonitoring();
    //   res.end(JSON.stringify({
    //     success: result,
    //     message: result ? '已启动自动监控' : '监控已在运行中'
    //   }));
    // } else if (url.pathname === '/stop-monitor') {
    //   // 停止自动监控
    //   const result = stopWhaleMonitoring();
    //   res.end(JSON.stringify({
    //     success: result,
    //     message: result ? '已停止自动监控' : '监控未在运行'
    //   }));
    } else if (url.pathname === '/start-websocket') {
      // 启动WebSocket实时监听
      const result = await websocketMonitor.startMonitoring();
      res.end(JSON.stringify({
        success: result,
        message: result ? '已启动WebSocket实时监听' : 'WebSocket监听已在运行中'
      }));
    } else if (url.pathname === '/stop-websocket') {
      // 停止WebSocket监听
      const result = websocketMonitor.stopMonitoring();
      res.end(JSON.stringify({
        success: result,
        message: result ? '已停止WebSocket监听' : 'WebSocket监听未在运行'
      }));
    } else if (url.pathname === '/websocket-status') {
      // 获取WebSocket状态
      const status = websocketMonitor.getStatus();
      res.end(JSON.stringify({
        success: true,
        status
      }));
    } else {
      // 不支持的路径
      res.statusCode = 404;
      res.end(JSON.stringify({ success: false, message: '未找到路径' }));
    }
  } catch (error) {
    console.error('HTTP请求处理错误:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: `服务器错误: ${(error as Error).message}` }));
  }
});

// 未使用的fetchPrice函数已移除

// 重复的辅助函数已移除，使用whaleMonitor服务中的版本

// 全局变量，用于跟踪程序状态
let isShuttingDown = false;

// 优雅地关闭
function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  
  console.log(`接收到${signal}信号，正在优雅退出...`);
  isShuttingDown = true;
  
  // 停止监控
  stopWhaleMonitoring();

  // 停止WebSocket监听
  websocketMonitor.stopMonitoring();

  // 停止所有cron任务
  try {
    const scheduledTasks = cron.getTasks();
    for (const task of scheduledTasks.keys()) {
      console.log(`停止定时任务: ${task}`);
      cron.getTasks().get(task)?.stop();
    }
  } catch (error) {
    console.error('停止cron任务失败:', error);
  }
  
  // 先清理监控资源
  cleanupMonitor().then(() => {
    console.log('监控资源已清理完毕');
    
    // 再关闭HTTP服务器
    server.close((err) => {
      if (err) {
        console.error('关闭HTTP服务器失败:', err);
      } else {
        console.log('HTTP服务器已关闭');
      }

      // 再停止机器人
      try {
        bot.stop(signal);
        console.log('Telegram机器人已停止');
      } catch (error) {
        console.error('停止Telegram机器人失败:', error);
      }

      // 发送关闭通知到频道
      const channelId = BOT_CONFIG.TELEGRAM_CHAT_ID;
      if (channelId) {
        try {
          safeSendMessage(channelId, '🤖 *交易监控机器人已停止*\n系统正在关闭...', { parse_mode: 'Markdown' })
            .catch(err => console.error('发送关闭通知失败:', err.message))
            .finally(() => {
              console.log('程序正常退出');
              // 强制退出，确保所有异步操作都被终止
              setTimeout(() => process.exit(0), 500);
            });
        } catch (error) {
          console.error('发送关闭通知失败:', error);
          console.log('程序正常退出');
          setTimeout(() => process.exit(0), 500);
        }
      } else {
        console.log('程序正常退出');
        // 强制退出，确保所有异步操作都被终止
        setTimeout(() => process.exit(0), 500);
      }
    });
  }).catch(error => {
    console.error('清理监控资源失败:', error);
    
    // 继续关闭其他服务
    server.close(() => {
      try {
        bot.stop(signal);
      } catch (error) {
        console.error('停止Telegram机器人失败:', error);
      }
      console.log('程序强制退出');
      setTimeout(() => process.exit(1), 1000);
    });
  });
}

// 主函数
async function main() {
  // 初始化鲸鱼监控
  initWhaleMonitor();
  
  // 启动HTTP服务器
  server.listen(BOT_CONFIG.PORT, () => {
    console.log(`HTTP服务器启动，监听端口${BOT_CONFIG.PORT}`);
    console.log('可通过以下URL控制WebSocket监控:');
    console.log(`- http://localhost:${BOT_CONFIG.PORT}/status (检查服务状态)`);
    console.log(`- http://localhost:${BOT_CONFIG.PORT}/start-websocket (启动WebSocket实时监听)`);
    console.log(`- http://localhost:${BOT_CONFIG.PORT}/stop-websocket (停止WebSocket监听)`);
    console.log(`- http://localhost:${BOT_CONFIG.PORT}/websocket-status (WebSocket状态)`);
  });
  
  // 启动机器人
  bot.launch().then(() => {
    console.log('机器人已成功启动！');
    
    // 启动WebSocket实时监听
    if (BOT_CONFIG.WHALE_MONITOR_ENABLED) {
      websocketMonitor.startMonitoring().then(success => {
        if (success) {
          console.log('✅ WebSocket实时监听已启动');
        } else {
          console.log('⚠️ WebSocket启动失败');
          // 注释掉轮询备用方案
          // startWhaleMonitoring();
        }
      }).catch(error => {
        console.error('WebSocket启动错误:', error);
        // 注释掉轮询备用方案
        // console.log('启用轮询监控作为备用');
        // startWhaleMonitoring();
      });
    }
    
    // 发送启动通知到频道
    const channelId = BOT_CONFIG.TELEGRAM_CHAT_ID;
    if (channelId) {
      safeSendMessage(channelId, '🤖 *交易监控机器人已启动*\n监控大额交易中，将自动推送通知...', { parse_mode: 'Markdown' })
        .catch(err => console.error('发送启动通知失败:', err.message));
    }
  }).catch(error => {
    console.error('机器人启动失败:', error);
  });
  
  // 注册信号处理程序
  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  // 处理未捕获的异常
  process.on('uncaughtException', (err) => {
    console.error('未捕获的异常:', err);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });
  // 处理未处理的Promise拒绝
  process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
  });
}

// 启动程序
main().catch(error => {
  console.error('程序执行错误:', error);
  process.exit(1);
}); 