import { Telegraf } from 'telegraf';
import { getCryptoPrice } from './price';
import { getTokenBySymbol } from '../config/tokens';

/**
 * 通知类型
 */
export enum NotificationType {
  WHALE_TRANSACTION = 'WHALE_TRANSACTION',
  LIQUIDITY_CHANGE = 'LIQUIDITY_CHANGE',
  PORTFOLIO_UPDATE = 'PORTFOLIO_UPDATE'
}

/**
 * 通知接口
 */
export interface Notification {
  id: string;
  type: NotificationType;
  userId: number;
  title: string;
  message: string;
  timestamp: Date;
  data?: any;
  sent: boolean;
}

// 存储通知队列（实际应用应使用消息队列或数据库）
const notificationQueue: Notification[] = [];

/**
 * 生成唯一通知ID
 */
function generateNotificationId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * 创建新通知
 * @param type 通知类型
 * @param userId 用户ID
 * @param title 通知标题
 * @param message 通知内容
 * @param data 附加数据
 */
export function createNotification(
  type: NotificationType,
  userId: number,
  title: string,
  message: string,
  data?: any
): Notification {
  const notification: Notification = {
    id: generateNotificationId(),
    type,
    userId,
    title,
    message,
    timestamp: new Date(),
    data,
    sent: false
  };
  
  notificationQueue.push(notification);
  return notification;
}

/**
 * 发送通知
 * @param bot Telegraf实例
 * @param notification 通知对象
 */
export async function sendNotification(
  bot: Telegraf,
  notification: Notification
): Promise<boolean> {
  try {
    if (notification.sent) {
      return true;
    }
    
    let formattedMessage = `🔔 *${notification.title}*\n`;
    formattedMessage += `---------------------\n`;
    formattedMessage += notification.message;
    
    await bot.telegram.sendMessage(notification.userId, formattedMessage, {
      parse_mode: 'Markdown'
    });
    
    // 标记为已发送
    notification.sent = true;
    return true;
  } catch (error) {
    const err = error as Error;
    console.error(`发送通知失败 (ID: ${notification.id}):`, err.message);
    return false;
  }
}



/**
 * 发送大额交易通知
 * @param bot Telegraf实例
 * @param userId 用户ID
 * @param chain 区块链
 * @param txHash 交易哈希
 * @param from 发送方
 * @param to 接收方
 * @param value 交易金额
 * @param symbol 代币符号
 */
export async function sendWhaleTransactionNotification(
  bot: Telegraf,
  userId: number,
  chain: 'ethereum' | 'solana',
  txHash: string,
  from: string,
  to: string,
  value: string,
  symbol: string
): Promise<boolean> {
  const explorerUrl = chain === 'ethereum' 
    ? `https://etherscan.io/tx/${txHash}`
    : `https://solscan.io/tx/${txHash}`;
  
  const notification = createNotification(
    NotificationType.WHALE_TRANSACTION,
    userId,
    `大额交易提醒`,
    `🐳 检测到${chain === 'ethereum' ? '以太坊' : 'Solana'}网络大额交易\n` +
    `💰 金额: ${value} ${symbol}\n` +
    `👤 从: ${from.slice(0, 6)}...${from.slice(-4)}\n` +
    `👥 至: ${to.slice(0, 6)}...${to.slice(-4)}\n` +
    `🔗 [查看交易](${explorerUrl})`,
    { chain, txHash, from, to, value, symbol }
  );
  
  return await sendNotification(bot, notification);
}

/**
 * 获取用户通知
 * @param userId 用户ID
 * @param limit 数量限制
 */
export function getUserNotifications(userId: number, limit = 10): Notification[] {
  return notificationQueue
    .filter(n => n.userId === userId)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}

/**
 * 清理已发送的通知
 * @param olderThan 清理多久之前的通知（毫秒）
 */
export function cleanupSentNotifications(olderThan = 24 * 60 * 60 * 1000): number {
  const now = new Date().getTime();
  let removedCount = 0;
  
  for (let i = notificationQueue.length - 1; i >= 0; i--) {
    const notification = notificationQueue[i];
    if (
      notification.sent && 
      now - notification.timestamp.getTime() > olderThan
    ) {
      notificationQueue.splice(i, 1);
      removedCount++;
    }
  }
  
  return removedCount;
}

// 每天自动清理通知
setInterval(() => {
  const removed = cleanupSentNotifications();
  if (removed > 0) {
    console.log(`已清理 ${removed} 条过期通知`);
  }
}, 6 * 60 * 60 * 1000);  // 每6小时运行一次

export default {
  createNotification,
  sendNotification,
  sendWhaleTransactionNotification,
  getUserNotifications,
  cleanupSentNotifications
};