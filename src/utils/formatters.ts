/**
 * 生成简单的文本图表
 * @param values 数值数组
 * @param width 图表宽度
 * @param height 图表高度
 * @returns 文本图表
 */
export function generateTextChart(
  values: number[],
  width = 20,
  height = 5
): string {
  if (!values || values.length === 0) {
    return '数据不足，无法生成图表';
  }
  
  // 查找最大值和最小值
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1; // 避免除以零
  
  // 生成图表
  const chart: string[] = [];
  
  // 创建Y轴标签
  const maxLabel = max.toFixed(1);
  const midLabel = ((max + min) / 2).toFixed(1);
  const minLabel = min.toFixed(1);
  
  // 添加顶部边框
  chart.push(`┌${'─'.repeat(width)}┐`);
  
  // 生成图表主体
  for (let i = 0; i < height; i++) {
    const row: string[] = ['│'];
    const normalizedHeight = height - 1 - i;
    
    for (let j = 0; j < width; j++) {
      // 映射数据索引到values数组
      const dataIndex = Math.floor(j * values.length / width);
      const value = values[dataIndex];
      
      // 将值标准化到图表高度
      const normalizedValue = Math.floor((value - min) / range * (height - 1));
      
      row.push(normalizedValue >= normalizedHeight ? '█' : ' ');
    }
    
    // 添加Y轴标签
    let yLabel = '';
    if (i === 0) yLabel = maxLabel;
    else if (i === Math.floor(height / 2)) yLabel = midLabel;
    else if (i === height - 1) yLabel = minLabel;
    
    row.push('│');
    if (yLabel) row.push(` ${yLabel}`);
    
    chart.push(row.join(''));
  }
  
  // 添加底部边框
  chart.push(`└${'─'.repeat(width)}┘`);
  
  return chart.join('\n');
}

/**
 * 格式化地址
 * @param address 地址字符串
 * @returns 格式化后的地址
 */
export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * 格式化数字为易读格式
 * @param num 数字
 * @param digits 保留小数位
 * @returns 格式化后的数字
 */
export function formatNumber(num: number, digits = 2): string {
  if (num === 0) return '0';
  
  // 处理非常小的数字
  if (Math.abs(num) < 0.00001) return num.toExponential(digits);
  
  // 小于1的数显示更多小数位
  if (Math.abs(num) < 1) return num.toFixed(6);
  
  // 常规数
  if (Math.abs(num) < 1000) return num.toFixed(digits);
  
  // 千级别
  if (Math.abs(num) < 1000000) return `${(num / 1000).toFixed(digits)}K`;
  
  // 百万级别
  if (Math.abs(num) < 1000000000) return `${(num / 1000000).toFixed(digits)}M`;
  
  // 十亿级别及以上
  return `${(num / 1000000000).toFixed(digits)}B`;
}

/**
 * 格式化日期时间
 * @param timestamp 时间戳
 * @returns 格式化后的日期时间
 */
export function formatDateTime(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化百分比
 * @param value 比例值(0-1)或百分比值 
 * @param digits 保留小数位
 * @param includeSymbol 是否包含百分号
 * @returns 格式化后的百分比
 */
export function formatPercentage(value: number, digits = 2, includeSymbol = true): string {
  // 如果是比例值(0-1)，则转换为百分比
  const percentValue = value <= 1 ? value * 100 : value;
  
  return `${percentValue.toFixed(digits)}${includeSymbol ? '%' : ''}`;
}

export default {
  generateTextChart,
  formatAddress,
  formatNumber,
  formatDateTime,
  formatPercentage
}; 