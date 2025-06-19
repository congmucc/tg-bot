/**
 * 格式化数字，添加千位分隔符，保留小数位
 * @param value 要格式化的数字或字符串
 * @param decimals 小数位数，默认为2
 */
export function formatNumber(value: number | string, decimals = 2): string {
  if (value === undefined || value === null) return '0';

  // 转换为数字
  const num = typeof value === 'string' ? parseFloat(value) : value;

  // 处理NaN
  if (isNaN(num)) return '0';

  // 根据大小选择合适的格式
  if (Math.abs(num) >= 1e9) {
    // 十亿及以上
    return (num / 1e9).toFixed(decimals) + 'B';
  } else if (Math.abs(num) >= 1e6) {
    // 百万及以上
    return (num / 1e6).toFixed(decimals) + 'M';
  } else if (Math.abs(num) >= 1e3) {
    // 千及以上
    return (num / 1e3).toFixed(decimals) + 'K';
  } else {
    // 小于千
    return num.toFixed(decimals);
  }
}

/**
 * 格式化金额，用于显示交易金额
 * @param value 要格式化的数字或字符串
 * @param decimals 小数位数，默认为2
 */
export function formatAmount(value: number | string, decimals = 2): string {
  if (value === undefined || value === null) return '0';

  // 转换为数字
  const num = typeof value === 'string' ? parseFloat(value) : value;

  // 处理NaN
  if (isNaN(num)) return '0';

  // 使用toLocaleString格式化数字，添加千位分隔符
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * 格式化百分比
 * @param value 要格式化的数字或字符串
 * @param decimals 小数位数，默认为2
 */
export function formatPercent(value: number | string, decimals = 2): string {
  if (value === undefined || value === null) return '0%';

  // 转换为数字
  const num = typeof value === 'string' ? parseFloat(value) : value;

  // 处理NaN
  if (isNaN(num)) return '0%';

  return num.toFixed(decimals) + '%';
}

/**
 * 缩短地址显示
 * @param address 区块链地址
 * @param prefixLength 前缀长度，默认为6
 * @param suffixLength 后缀长度，默认为4
 */
export function shortenAddress(address: string, prefixLength = 6, suffixLength = 4): string {
  if (!address) return '';

  if (address.length <= prefixLength + suffixLength) {
    return address;
  }

  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}

/**
 * 格式化时间戳为可读时间
 * @param timestamp 时间戳（秒或毫秒）
 */
export function formatTimestamp(timestamp: number): string {
  if (!timestamp) return '';

  // 确保时间戳是毫秒
  const ts = timestamp < 1e12 ? timestamp * 1000 : timestamp;

  return new Date(ts).toLocaleString();
}

/**
 * 格式化时间差为可读形式
 * @param timestamp 时间戳（秒或毫秒）
 */
export function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return '';

  // 确保时间戳是毫秒
  const ts = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const now = Date.now();
  const diff = now - ts;

  // 转换为秒
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) {
    return `${seconds}秒前`;
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}分钟前`;
  } else if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}小时前`;
  } else if (seconds < 2592000) {
    return `${Math.floor(seconds / 86400)}天前`;
  } else if (seconds < 31536000) {
    return `${Math.floor(seconds / 2592000)}个月前`;
  } else {
    return `${Math.floor(seconds / 31536000)}年前`;
  }
} 