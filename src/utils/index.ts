/**
 * 工具函数模块入口文件
 * 导出所有工具函数
 */

// HTTP工具
import HttpClient from './http/httpClient';
export { HttpClient };

// 加密货币工具
export * from './crypto/cryptoUtils';

// 格式化工具
export * from './format';

// 其他工具...

// 默认导出所有工具
export default {
  HttpClient,
};

// 重复的formatAmount函数已移除，使用format.ts中的版本

/**
 * 缩略地址，只显示开头和结尾的几个字符
 * @param address 完整地址
 * @param frontChars 前面显示的字符数
 * @param endChars 后面显示的字符数
 */
export function shortenAddress(address: string, frontChars: number = 6, endChars: number = 4): string {
  if (!address || address.length <= frontChars + endChars) {
    return address || '';
  }
  
  return `${address.substring(0, frontChars)}...${address.substring(address.length - endChars)}`;
}

/**
 * 格式化百分比
 * @param value 百分比值（例如0.05表示5%）
 * @param decimals 小数位数
 * @param includeSymbol 是否包含%符号
 */
export function formatPercent(value: number, decimals: number = 2, includeSymbol: boolean = true): string {
  const percentage = value * 100;
  const formatted = percentage.toFixed(decimals);
  return includeSymbol ? `${formatted}%` : formatted;
}

/**
 * 格式化时间戳为本地日期时间字符串
 * @param timestamp Unix时间戳（秒）
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

/**
 * 简单的数据脱敏函数
 * @param text 需要部分隐藏的文本
 */
export function maskData(text: string): string {
  if (!text || text.length <= 8) {
    return '****';
  }
  
  const visibleStart = text.substring(0, 4);
  const visibleEnd = text.substring(text.length - 4);
  const masked = '*'.repeat(Math.min(10, text.length - 8));
  
  return `${visibleStart}${masked}${visibleEnd}`;
}

/**
 * 验证以太坊地址是否有效
 * @param address 以太坊地址
 * @returns 是否有效
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * 验证Solana地址是否有效
 * @param address Solana地址
 * @returns 是否有效
 */
export function isValidSolanaAddress(address: string): boolean {
  // Solana地址是一个base58编码的字符串，通常是32-44个字符
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
} 