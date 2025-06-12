import { monitorLargeTransactions } from '../api/blockchain';
import { formatTokenPrice } from './price';

/**
 * 大额交易监控结果
 */
export interface WhaleTransactionMonitorResult {
  success: boolean;
  ethereum?: {
    transactions: WhaleTransaction[];
    count: number;
  };
  bsc?: {
    transactions: WhaleTransaction[];
    count: number;
  };
  timestamp: number;
  error?: string;
}

/**
 * 大额交易信息
 */
export interface WhaleTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  formattedValue: string;
  timestamp: number;
  date: string;
  blockNumber: number;
  chain: 'ethereum' | 'bsc';
  tokenSymbol: 'ETH' | 'BNB';
}

/**
 * 监控鲸鱼交易
 * @param ethThreshold ETH最小阈值
 * @param bscThreshold BNB最小阈值
 */
export async function monitorWhaleTransactions(
  ethThreshold = 100,
  bscThreshold = 200
): Promise<WhaleTransactionMonitorResult> {
  try {
    const results = await monitorLargeTransactions(ethThreshold, bscThreshold);
    
    const processedResults: WhaleTransactionMonitorResult = {
      success: true,
      timestamp: Date.now()
    };
    
    // 处理以太坊结果
    const ethResult = results.find(result => result.chain === 'ethereum');
    if (ethResult && ethResult.success) {
      processedResults.ethereum = {
        transactions: ethResult.transactions.map((tx: any) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          formattedValue: formatTokenPrice(parseFloat(tx.value), 'USD'),
          timestamp: parseInt(tx.timestamp),
          date: new Date(parseInt(tx.timestamp) * 1000).toISOString(),
          blockNumber: parseInt(tx.blockNumber),
          chain: 'ethereum',
          tokenSymbol: 'ETH'
        })),
        count: ethResult.count
      };
    }
    
    // 处理BSC结果
    const bscResult = results.find(result => result.chain === 'bsc');
    if (bscResult && bscResult.success) {
      processedResults.bsc = {
        transactions: bscResult.transactions.map((tx: any) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          formattedValue: formatTokenPrice(parseFloat(tx.value), 'USD'),
          timestamp: parseInt(tx.timestamp),
          date: new Date(parseInt(tx.timestamp) * 1000).toISOString(),
          blockNumber: parseInt(tx.blockNumber),
          chain: 'bsc',
          tokenSymbol: 'BNB'
        })),
        count: bscResult.count
      };
    }
    
    return processedResults;
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      timestamp: Date.now(),
      error: err.message
    };
  }
}

/**
 * 格式化鲸鱼交易消息
 * @param result 监控结果
 * @param limit 每条链返回的交易数量
 */
export function formatWhaleTransactionsMessage(result: WhaleTransactionMonitorResult, limit = 3): string {
  if (!result.success) {
    return `❌ 监控鲸鱼交易失败: ${result.error}`;
  }
  
  let message = `🐳 *最新鲸鱼交易监控* 🐳\n更新时间: ${new Date(result.timestamp).toLocaleString()}\n\n`;
  
  // 格式化以太坊交易
  if (result.ethereum && result.ethereum.transactions.length > 0) {
    message += `*以太坊大额交易* (共${result.ethereum.count}笔):\n`;
    
    result.ethereum.transactions.slice(0, limit).forEach((tx, index) => {
      message += `${index + 1}. ${tx.formattedValue} ETH - ${shortenAddress(tx.from)} → ${shortenAddress(tx.to)}\n`;
      message += `   🔍 [交易详情](https://etherscan.io/tx/${tx.hash})\n`;
    });
    
    message += `\n`;
  }
  
  // 格式化BSC交易
  if (result.bsc && result.bsc.transactions.length > 0) {
    message += `*BSC大额交易* (共${result.bsc.count}笔):\n`;
    
    result.bsc.transactions.slice(0, limit).forEach((tx, index) => {
      message += `${index + 1}. ${tx.formattedValue} BNB - ${shortenAddress(tx.from)} → ${shortenAddress(tx.to)}\n`;
      message += `   🔍 [交易详情](https://bscscan.com/tx/${tx.hash})\n`;
    });
  }
  
  return message;
}

/**
 * 简化地址显示
 * @param address 地址
 */
function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default {
  monitorWhaleTransactions,
  formatWhaleTransactionsMessage
}; 