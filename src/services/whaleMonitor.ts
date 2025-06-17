import { safeSendMessage } from '../utils/telegram';
import ethereumApi from '../api/blockchain/ethereum';
import solanaApi from '../api/blockchain/solana';
import bitcoinApi from '../api/blockchain/bitcoin';
import hyperliquidApi from '../api/blockchain/hyperliquidApi';
import { formatAmount, shortenAddress } from '../utils/format';
import { BOT_CONFIG } from '../config/env';

// 监控状态
let isMonitoring = false;
let whaleMonitoringInterval: NodeJS.Timeout | null = null;
let lastMonitorTime = 0;
let isShuttingDown = false; // 添加关闭标志
const COOLDOWN_TIME = BOT_CONFIG.WHALE_MONITOR_COOLDOWN * 1000; // 冷却时间(毫秒)
const MAX_BATCH_SIZE = BOT_CONFIG.WHALE_MONITOR_BATCH_SIZE; // 每次最多发送的交易数量

// 交易缓存，用于去重
const transactionCache = new Set<string>();
const CACHE_MAX_SIZE = 1000; // 最大缓存大小



/**
 * 初始化鲸鱼监控
 */
export function initWhaleMonitor(): void {
  console.log('初始化简化的鲸鱼监控系统');
}







/**
 * 启动大额交易监控
 */
export function startWhaleMonitoring(): boolean {
  if (isMonitoring) {
    return false; // 已经在监控中
  }

  try {
    console.log('启动简化的大额交易监控');

    // 使用简单的定时器进行轮询监控
    whaleMonitoringInterval = setInterval(async () => {
      // 检查是否正在关闭
      if (isShuttingDown) {
        console.log('检测到关闭信号，停止监控任务');
        stopWhaleMonitoring();
        return;
      }

      try {
        const channelId = BOT_CONFIG.TELEGRAM_CHAT_ID;
        if (channelId) {
          await sendWhaleAlert(channelId);
        } else {
          console.error('未配置TELEGRAM_CHAT_ID，无法发送通知');
        }
      } catch (error) {
        console.error('监控任务执行失败:', error);
      }
    }, 30000); // 每30秒执行一次

    isMonitoring = true;
    return true;
  } catch (error) {
    console.error('启动监控失败:', error);
    return false;
  }
}

/**
 * 停止大额交易监控
 */
export function stopWhaleMonitoring(): boolean {
  try {
    console.log('停止大额交易监控');

    // 设置关闭标志
    isShuttingDown = true;

    if (whaleMonitoringInterval) {
      clearInterval(whaleMonitoringInterval);
      whaleMonitoringInterval = null;
    }

    isMonitoring = false;
    return true;
  } catch (error) {
    console.error('停止监控失败:', error);
    return false;
  }
}

/**
 * 清理资源并关闭监控
 * 用于程序退出前的清理工作
 */
export function cleanupMonitor(): Promise<void> {
  return new Promise<void>((resolve) => {
    console.log('清理监控资源...');

    // 设置关闭标志
    isShuttingDown = true;

    // 确保停止监控
    stopWhaleMonitoring();

    // 清理缓存
    transactionCache.clear();

    console.log('监控资源清理完成');
    resolve();
  });
}

/**
 * 获取监控状态
 */
export function getMonitoringStatus(): { active: boolean; mode: string; interval?: string; lastRun?: Date } {
  return {
    active: isMonitoring,
    mode: "简化轮询",
    interval: "30秒",
    lastRun: lastMonitorTime > 0 ? new Date(lastMonitorTime) : undefined
  };
}

/**
 * 发送大额交易提醒
 */
export async function sendWhaleAlert(channelId: string): Promise<boolean> {
  // 检查是否正在关闭
  if (isShuttingDown) {
    console.log('系统正在关闭，跳过监控任务');
    return false;
  }

  // 检查冷却时间
  const now = Date.now();
  if (now - lastMonitorTime < COOLDOWN_TIME) {
    console.log(`发送大额交易提醒处于冷却中，剩余 ${((COOLDOWN_TIME - (now - lastMonitorTime)) / 1000).toFixed(1)} 秒`);
    return false;
  }

  lastMonitorTime = now;
  
  try {
    // 设置监控阈值
    const minValueEth = 100; // 以太坊默认100 ETH
    const minValueSol = 500; // Solana默认500 SOL
    const minValueBtc = 10; // 比特币默认10 BTC
    const minValueHyperliquid = 100000; // Hyperliquid默认10万美元
    
    let results: any[] = [];
    let errors: string[] = [];
    
    try {
      // 尝试获取大额交易，分别处理不同链，即使一个链失败也不影响其他链
      try {
        const ethResults = await ethereumApi.getLargeTransactions(minValueEth);
        results = results.concat(ethResults.map((tx: any) => ({ chain: 'ethereum', ...tx })));
      } catch (ethError) {
        console.error(`以太坊大额交易监控失败: ${(ethError as Error).message}`);
        errors.push(`ETH: ${(ethError as Error).message}`);
      }

      try {
        const solResults = await solanaApi.getLargeTransactions(minValueSol);
        results = results.concat(solResults.map((tx: any) => ({ chain: 'solana', ...tx })));
      } catch (solError) {
        console.error(`Solana大额交易监控失败: ${(solError as Error).message}`);
        errors.push(`SOL: ${(solError as Error).message}`);
      }

      try {
        const btcResults = await bitcoinApi.getLargeTransactions(minValueBtc);
        results = results.concat(btcResults.map((tx: any) => ({ chain: 'bitcoin', ...tx })));
      } catch (btcError) {
        console.error(`比特币大额交易监控失败: ${(btcError as Error).message}`);
        errors.push(`BTC: ${(btcError as Error).message}`);
      }

      try {
        const hyperliquidResults = await hyperliquidApi.getLargeTransactions(minValueHyperliquid);
        results = results.concat(hyperliquidResults.map((tx: any) => ({ chain: 'hyperliquid', ...tx })));
      } catch (hlError) {
        console.error(`Hyperliquid大额交易监控失败: ${(hlError as Error).message}`);
        errors.push(`HL: ${(hlError as Error).message}`);
      }
      
      // 如果所有API都失败了
      if (results.length === 0) {
        const errMsg = `所有链的大额交易监控均失败: ${errors.join(', ')}`;
        console.error(errMsg);
        return false;
      }
      
    } catch (error) {
      console.error(`监控大额交易时发生错误: ${(error as Error).message}`);
      return false;
    }

    let foundTransactions = 0;
    let processedTransactions = 0;
    
    // 过滤出新的交易（之前未推送过的）
    const newTransactions = results.filter(tx => !transactionCache.has(tx.hash));
    
    if (newTransactions.length === 0) {
      console.log('没有发现新的大额交易');
      return true;
    }
    
    foundTransactions = newTransactions.length;
    console.log(`发现${foundTransactions}笔新的大额交易`);
    
    // 为每笔新交易生成消息并推送，但限制每次最多推送MAX_BATCH_SIZE笔交易
    const transactionsToProcess = newTransactions.slice(0, MAX_BATCH_SIZE);
    
    for (const tx of transactionsToProcess) {
      // 添加到缓存
      transactionCache.add(tx.hash);
      if (transactionCache.size > CACHE_MAX_SIZE) {
        const iterator = transactionCache.values();
        for (let i = 0; i < 100; i++) {
          const next = iterator.next();
          if (!next.done && next.value) {
            transactionCache.delete(next.value);
          }
        }
      }
      
      let message = `
🚨 *新${getChainDisplayName(tx.chain)}大额交易发现* 🚨
---------------------
`;
      
      if (tx.chain === 'hyperliquid') {
        // 处理Hyperliquid特有字段
        const value = formatAmount(tx.value);
        const size = tx.size ? formatAmount(tx.size) : '';
        const price = tx.price ? formatAmount(tx.price) : '';
        
        message += `
💰 *$${value}* ${size && price ? `(${size} @ $${price})` : ''}
${tx.symbol ? `📊 ${tx.symbol} ${tx.side === 'buy' ? '买入' : '卖出'}` : ''}
👤 从: ${shortenAddress(tx.from)}
👥 至: ${shortenAddress(tx.to)}
🔗 [查看交易](https://explorer.hyperliquid.xyz/tx/${tx.hash})
⏰ ${new Date(tx.timestamp * 1000).toLocaleString()}
`;
      } else {
        // 以太坊、Solana和比特币的常规处理
        const txUrl = getExplorerUrl(tx.chain, tx.hash);
        let symbol = 'UNKNOWN';
        if (tx.chain === 'ethereum') symbol = 'ETH';
        else if (tx.chain === 'solana') symbol = 'SOL';
        else if (tx.chain === 'bitcoin') symbol = 'BTC';

        const value = formatAmount(tx.value);

        message += `
💰 *${value} ${symbol}*
👤 从: [${shortenAddress(tx.from)}](${getExplorerUrl(tx.chain, tx.from, 'address')})
👥 至: [${shortenAddress(tx.to)}](${getExplorerUrl(tx.chain, tx.to, 'address')})
🔗 [查看交易](${txUrl})
⏰ ${new Date(tx.timestamp * 1000).toLocaleString()}
`;
      }
      
      // 发送消息到频道
      await safeSendMessage(channelId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
      processedTransactions++;
      
      // 每次发送后等待1秒，避免触发Telegram频率限制
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 如果有超过显示限制的交易，添加一条汇总消息
    if (newTransactions.length > MAX_BATCH_SIZE) {
      const remainingCount = newTransactions.length - MAX_BATCH_SIZE;
      const summaryMessage = `
📊 *交易汇总* 
还有 *${remainingCount}* 笔大额交易未显示，请访问区块浏览器查看更多交易。
`;
      await safeSendMessage(channelId, summaryMessage, { parse_mode: 'Markdown' });
      
      // 将剩余交易也记录为已发送，避免下次重复
      newTransactions.slice(MAX_BATCH_SIZE).forEach(tx => transactionCache.add(tx.hash));
    }
    
    console.log(`成功推送${processedTransactions}笔新交易，总计发现${foundTransactions}笔`);
    
    // 如果有错误信息，记录到日志
    if (errors.length > 0) {
      console.warn(`部分链监控出错: ${errors.join(', ')}`);
    }
    
    return true;
  } catch (error) {
    console.error(`发送大额交易提醒失败: ${(error as Error).message}`);
    return false;
  }
}

/**
 * 获取区块链的显示名称
 * @param chain 链名
 * @returns 显示名称
 */
function getChainDisplayName(chain: string): string {
  switch (chain) {
    case 'ethereum':
      return '以太坊';
    case 'solana':
      return 'Solana';
    case 'bitcoin':
      return '比特币';
    case 'hyperliquid':
      return 'Hyperliquid';
    default:
      return chain;
  }
}

/**
 * 获取对应区块链的区块浏览器URL
 * @param chain 链名
 * @param hash 交易哈希/地址
 * @param type 类型（交易或地址）
 * @returns 浏览器URL
 */
function getExplorerUrl(chain: string, hash: string, type: 'tx' | 'address' = 'tx'): string {
  switch (chain) {
    case 'ethereum':
      return `https://etherscan.io/${type}/${hash}`;
    case 'solana':
      return `https://solscan.io/${type === 'tx' ? 'tx' : 'account'}/${hash}`;
    case 'bitcoin':
      return `https://blockstream.info/${type === 'tx' ? 'tx' : 'address'}/${hash}`;
    case 'hyperliquid':
      return `https://explorer.hyperliquid.xyz/${type}/${hash}`;
    default:
      return '#';
  }
}