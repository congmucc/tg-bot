import { Context } from 'telegraf';
import { Markup } from 'telegraf';
import websocketMonitor from '../../services/websocketMonitor';

/**
 * 处理鲸鱼监控命令
 * @param ctx Telegraf上下文
 */
export async function handleWhaleCommand(ctx: Context): Promise<void> {
  await ctx.sendChatAction('typing');

  const message = ctx.message;
  // 确保消息是文本消息
  if (!message || !('text' in message)) {
    await ctx.reply('无法处理此类消息');
    return;
  }

  // 解析命令参数
  const args = message.text.split(' ').filter(arg => arg.trim() !== '');

  try {
    // 获取WebSocket监听状态
    const status = websocketMonitor.getStatus();

    if (args.length > 1) {
      const subCommand = args[1].toLowerCase();

      if (subCommand === 'start') {
        // 启动WebSocket监听
        const success = await websocketMonitor.startMonitoring();
        if (success) {
          await ctx.reply('🚀 *WebSocket鲸鱼监听已启动*\n\n将实时监控以下链的大额交易:\n• 以太坊 (≥1 ETH)\n• Solana (≥10 SOL)\n• 比特币 (≥0.1 BTC)\n• Hyperliquid (≥$1,000)', { parse_mode: 'Markdown' });
        } else {
          await ctx.reply('⚠️ WebSocket监听已在运行中');
        }
        return;
      }

      if (subCommand === 'stop') {
        // 停止WebSocket监听
        const success = websocketMonitor.stopMonitoring();
        if (success) {
          await ctx.reply('🛑 *WebSocket鲸鱼监听已停止*', { parse_mode: 'Markdown' });
        } else {
          await ctx.reply('⚠️ WebSocket监听未在运行');
        }
        return;
      }

      if (subCommand === 'status') {
        // 显示监听状态
        const statusText = status.active ? '🟢 运行中' : '🔴 已停止';
        const connections = Object.entries(status.connections)
          .map(([chain, conn]) => `${chain}: ${conn === 'connected' ? '🟢' : '🔴'}`)
          .join('\n');

        await ctx.reply(
          `🐳 *WebSocket鲸鱼监听状态*\n\n` +
          `状态: ${statusText}\n\n` +
          `连接状态:\n${connections}\n\n` +
          `监控阈值:\n` +
          `• 以太坊: ≥1 ETH\n` +
          `• Solana: ≥10 SOL\n` +
          `• 比特币: ≥0.1 BTC\n` +
          `• Hyperliquid: ≥$1,000`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
    }

    // 默认显示帮助信息
    const statusText = status.active ? '🟢 运行中' : '🔴 已停止';

    await ctx.reply(
      `🐋 *鲸鱼监控 - WebSocket实时监听*\n\n` +
      `当前状态: ${statusText}\n\n` +
      `💎 *现货大额交易监控:*\n` +
      `🔵 以太坊: ≥50 ETH (~$125K)\n` +
      `🟣 Solana: ≥500 SOL (~$75K)\n` +
      `🟡 比特币: ≥5 BTC (~$325K)\n` +
      `🟠 Hyperliquid: ≥$50,000\n\n` +
      `📈 *合约交易监控 (测试阈值):*\n` +
      `🔵 以太坊DeFi: ≥$1,000\n` +
      `🟣 Solana DeFi: ≥$500\n` +
      `🟠 Hyperliquid合约: ≥$1,000\n\n` +
      `🚨 检测到大额交易将自动推送到此频道`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('🚀 启动监听', 'whale_start'),
            Markup.button.callback('🛑 停止监听', 'whale_stop')
          ],
          [
            Markup.button.callback('📊 查看状态', 'whale_status')
          ]
        ])
      }
    );

  } catch (error) {
    const err = error as Error;
    await ctx.reply(`处理鲸鱼监控命令时发生错误: ${err.message}`);
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

/**
 * 简化地址显示
 * @param address 地址
 */
function shortenAddress(address: string): string {
  if (!address || address === 'Unknown') return 'Unknown';
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
} 