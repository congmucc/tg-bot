import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { API_CONFIG } from '../../config/env';
import { formatNumber, shortenAddress } from '../../utils/format';

// 定义交易事件类型
export interface TransactionEvent {
  chain: 'ethereum' | 'solana' | 'hyperliquid';
  hash: string;
  from: string;
  to: string;
  value: number;
  timestamp: number;
  symbol?: string;
  size?: number;
  price?: number;
  side?: 'buy' | 'sell';
}

// WebSocket监控类
class WebSocketMonitor extends EventEmitter {
  private ethereumWs: WebSocket | null = null;
  private solanaWs: WebSocket | null = null;
  private hyperliquidWs: WebSocket | null = null;
  private isMonitoring: boolean = false;
  private reconnectAttempts: Record<string, number> = {
    ethereum: 0,
    solana: 0,
    hyperliquid: 0
  };
  private minValueEth: number = 100; // 以太坊最小交易额
  private minValueSol: number = 500; // Solana最小交易额
  private minValueHyperliquid: number = 100000; // Hyperliquid最小交易额
  private reconnectInterval: number = 10000; // 重连间隔(毫秒)
  private maxReconnectAttempts: number = 5; // 最大重连尝试次数
  private transactionCache: Set<string> = new Set(); // 交易缓存，避免重复

  constructor() {
    super();
    // 设置最大监听器数量
    this.setMaxListeners(20);
  }

  /**
   * 启动WebSocket监控
   * @param minValueEth 以太坊最小交易金额
   * @param minValueSol Solana最小交易金额
   * @param minValueHyperliquid Hyperliquid最小交易金额
   */
  public startMonitoring(
    minValueEth: number = 100, 
    minValueSol: number = 500, 
    minValueHyperliquid: number = 100000
  ): void {
    if (this.isMonitoring) {
      console.log('WebSocket监控已经在运行');
      return;
    }
    
    this.minValueEth = minValueEth;
    this.minValueSol = minValueSol;
    this.minValueHyperliquid = minValueHyperliquid;
    this.isMonitoring = true;
    
    console.log(`启动WebSocket监控 - ETH: ${minValueEth} ETH, SOL: ${minValueSol} SOL, HL: $${minValueHyperliquid}`);
    
    // 启动各链的WebSocket连接
    this.connectEthereumWebSocket();
    this.connectSolanaWebSocket();
    this.connectHyperliquidWebSocket();
  }

  /**
   * 停止WebSocket监控
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }
    
    console.log('停止WebSocket监控');
    this.isMonitoring = false;
    
    // 关闭所有连接
    this.closeConnection(this.ethereumWs);
    this.closeConnection(this.solanaWs);
    this.closeConnection(this.hyperliquidWs);
    
    // 重置连接
    this.ethereumWs = null;
    this.solanaWs = null;
    this.hyperliquidWs = null;
    
    // 重置重连尝试次数
    this.reconnectAttempts = {
      ethereum: 0,
      solana: 0,
      hyperliquid: 0
    };
  }

  /**
   * 安全关闭WebSocket连接
   */
  private closeConnection(ws: WebSocket | null): void {
    if (ws) {
      try {
        ws.terminate();
      } catch (error) {
        console.error('关闭WebSocket连接失败:', error);
      }
    }
  }

  /**
   * 连接以太坊WebSocket
   */
  private connectEthereumWebSocket(): void {
    try {
      // 关闭现有连接
      this.closeConnection(this.ethereumWs);
      
      // 获取WebSocket URL，优先使用配置的WS URL
      const wsUrl = process.env.ETHEREUM_WS_URL || API_CONFIG.ETHEREUM_WS_URL || '';
      
      if (!wsUrl || wsUrl.includes('demo')) {
        console.warn('未配置有效的以太坊WebSocket URL，无法监控以太坊大额交易');
        return;
      }
      
      console.log(`连接以太坊WebSocket: ${wsUrl}`);
      this.ethereumWs = new WebSocket(wsUrl);
      
      this.ethereumWs.on('open', () => {
        console.log('以太坊WebSocket连接成功');
        this.reconnectAttempts.ethereum = 0;
        
        // 订阅新交易
        const subscribeMsg = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_subscribe',
          params: ['newPendingTransactions']
        });
        
        if (this.ethereumWs && this.ethereumWs.readyState === WebSocket.OPEN) {
          this.ethereumWs.send(subscribeMsg);
        }
      });
      
      this.ethereumWs.on('message', (data: WebSocket.Data) => {
        try {
          const response = JSON.parse(data.toString());
          
          // 如果是订阅确认消息，忽略
          if (response.id === 1) return;
          
          // 如果是交易通知
          if (response.method === 'eth_subscription' && response.params.subscription) {
            const txHash = response.params.result;
            
            // 避免重复处理相同的交易
            if (this.transactionCache.has(txHash)) return;
            this.transactionCache.add(txHash);
            
            // 限制缓存大小
            if (this.transactionCache.size > 1000) {
              const iterator = this.transactionCache.values();
              this.transactionCache.delete(iterator.next().value);
            }
            
            // 获取交易详情
            const txDetailsMsg = JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'eth_getTransactionByHash',
              params: [txHash]
            });
            
            if (this.ethereumWs && this.ethereumWs.readyState === WebSocket.OPEN) {
              this.ethereumWs.send(txDetailsMsg);
            }
          } 
          // 如果是交易详情响应
          else if (response.id === 2 && response.result) {
            const tx = response.result;
            
            // 交易值转换为ETH
            const value = parseInt(tx.value, 16) / 1e18;
            
            // 过滤小额交易
            if (value >= this.minValueEth) {
              // 发送交易事件
              const txEvent: TransactionEvent = {
                chain: 'ethereum',
                hash: tx.hash,
                from: tx.from,
                to: tx.to || 'Contract Creation',
                value: value,
                timestamp: Math.floor(Date.now() / 1000)
              };
              
              this.emit('transaction', txEvent);
            }
          }
        } catch (error) {
          console.error('处理以太坊WebSocket消息出错:', error);
        }
      });
      
      this.ethereumWs.on('error', (error) => {
        console.error('以太坊WebSocket错误:', error);
      });
      
      this.ethereumWs.on('close', () => {
        console.log('以太坊WebSocket连接关闭');
        this.handleReconnect('ethereum');
      });
    } catch (error) {
      console.error('连接以太坊WebSocket失败:', error);
      this.handleReconnect('ethereum');
    }
  }

  /**
   * 连接Solana WebSocket
   */
  private connectSolanaWebSocket(): void {
    try {
      // 关闭现有连接
      this.closeConnection(this.solanaWs);
      
      // 获取WebSocket URL
      const wsUrl = process.env.SOLANA_WS_URL || API_CONFIG.SOLANA_WS_URL || '';
      
      if (!wsUrl) {
        console.warn('未配置有效的Solana WebSocket URL，无法监控Solana大额交易');
        return;
      }
      
      console.log(`连接Solana WebSocket: ${wsUrl}`);
      this.solanaWs = new WebSocket(wsUrl);
      
      this.solanaWs.on('open', () => {
        console.log('Solana WebSocket连接成功');
        this.reconnectAttempts.solana = 0;
        
        // 订阅新交易，优先使用transaction并开启扩展数据
        const subscribeMsg = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'transactionSubscribe',
          params: [
            { commitment: 'confirmed', encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
          ]
        });
        
        if (this.solanaWs && this.solanaWs.readyState === WebSocket.OPEN) {
          this.solanaWs.send(subscribeMsg);
        }
      });
      
      this.solanaWs.on('message', (data: WebSocket.Data) => {
        try {
          const response = JSON.parse(data.toString());
          
          // 如果是订阅确认消息，忽略
          if (response.id === 1) return;
          
          // 如果是交易通知
          if (response.method === 'transactionNotification' && response.params?.result?.value) {
            const txData = response.params.result.value;
            const txHash = txData.signature || '';
            
            // 避免重复处理相同的交易
            if (this.transactionCache.has(txHash)) return;
            this.transactionCache.add(txHash);
            
            // 限制缓存大小
            if (this.transactionCache.size > 1000) {
              const iterator = this.transactionCache.values();
              this.transactionCache.delete(iterator.next().value);
            }
            
            // 处理交易数据，提取交易金额
            let totalValue = 0;
            let sender = '';
            let receiver = '';
            
            // 解析交易中的转账
            if (txData.transaction?.message?.instructions) {
              for (const instruction of txData.transaction.message.instructions) {
                // 系统程序转账
                if (instruction.programId === '11111111111111111111111111111111') {
                  try {
                    // 如果有parsed数据，使用它
                    if (instruction.parsed && instruction.parsed.type === 'transfer') {
                      const solAmount = instruction.parsed.info.lamports / 1e9;
                      totalValue += solAmount;
                      
                      // 记录发送方和接收方
                      sender = instruction.parsed.info.source || sender;
                      receiver = instruction.parsed.info.destination || receiver;
                    }
                    // 否则尝试手动解析
                    else if (instruction.data) {
                      const data = Buffer.from(instruction.data, 'base64');
                      
                      // 转账指令的数据格式: [2, ...amount(8字节)]
                      if (data[0] === 2) {
                        const lamports = data.readBigUInt64LE(1);
                        const solAmount = Number(lamports) / 1e9;
                        totalValue += solAmount;
                        
                        // 记录发送方和接收方
                        if (instruction.accounts && instruction.accounts.length >= 2) {
                          const accountIndexes = instruction.accounts;
                          sender = txData.transaction.message.accountKeys[accountIndexes[0]] || sender;
                          receiver = txData.transaction.message.accountKeys[accountIndexes[1]] || receiver;
                        }
                      }
                    }
                  } catch (parseError) {
                    console.error('解析Solana交易数据出错:', parseError);
                  }
                }
              }
            }
            
            // 如果是大额交易
            if (totalValue >= this.minValueSol) {
              // 发送交易事件
              const txEvent: TransactionEvent = {
                chain: 'solana',
                hash: txHash,
                from: sender || 'Unknown',
                to: receiver || 'Unknown',
                value: totalValue,
                timestamp: txData.blockTime || Math.floor(Date.now() / 1000)
              };
              
              this.emit('transaction', txEvent);
            }
          }
        } catch (error) {
          console.error('处理Solana WebSocket消息出错:', error);
        }
      });
      
      this.solanaWs.on('error', (error) => {
        console.error('Solana WebSocket错误:', error);
      });
      
      this.solanaWs.on('close', () => {
        console.log('Solana WebSocket连接关闭');
        this.handleReconnect('solana');
      });
    } catch (error) {
      console.error('连接Solana WebSocket失败:', error);
      this.handleReconnect('solana');
    }
  }

  /**
   * 连接Hyperliquid WebSocket
   */
  private connectHyperliquidWebSocket(): void {
    try {
      // 关闭现有连接
      this.closeConnection(this.hyperliquidWs);
      
      const wsUrl = API_CONFIG.HYPERLIQUID_WS_URL || 'wss://api.hyperliquid.xyz/ws';
      console.log(`连接Hyperliquid WebSocket: ${wsUrl}`);
      this.hyperliquidWs = new WebSocket(wsUrl);
      
      this.hyperliquidWs.on('open', () => {
        console.log('Hyperliquid WebSocket连接成功');
        this.reconnectAttempts.hyperliquid = 0;
        
        // 订阅交易
        const subscribeMsg = JSON.stringify({
          method: 'subscribe',
          subscription: 'trades'
        });
        
        if (this.hyperliquidWs && this.hyperliquidWs.readyState === WebSocket.OPEN) {
          this.hyperliquidWs.send(subscribeMsg);
        }
      });
      
      this.hyperliquidWs.on('message', (data: WebSocket.Data) => {
        try {
          const response = JSON.parse(data.toString());
          
          // 如果是心跳消息，忽略
          if (response.type === 'pong') return;
          
          // 处理交易数据
          if (response.channel === 'trades' && Array.isArray(response.data)) {
            for (const trade of response.data) {
              // 避免重复处理相同的交易
              const tradeId = trade.tid || `${trade.coin}-${trade.time}`;
              if (this.transactionCache.has(tradeId)) continue;
              this.transactionCache.add(tradeId);
              
              // 限制缓存大小
              if (this.transactionCache.size > 1000) {
                const iterator = this.transactionCache.values();
                this.transactionCache.delete(iterator.next().value);
              }
              
              // 计算交易价值 = 价格 * 数量
              const tradeValue = trade.px * trade.sz;
              
              // 过滤小额交易
              if (tradeValue >= this.minValueHyperliquid) {
                const txEvent: TransactionEvent = {
                  chain: 'hyperliquid',
                  hash: trade.tid || `hl-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
                  from: trade.maker || 'Unknown',
                  to: trade.taker || 'Unknown',
                  value: tradeValue,
                  timestamp: Math.floor(trade.time / 1000) || Math.floor(Date.now() / 1000),
                  symbol: trade.coin,
                  size: trade.sz,
                  price: trade.px,
                  side: trade.side
                };
                
                this.emit('transaction', txEvent);
              }
            }
          }
        } catch (error) {
          console.error('处理Hyperliquid WebSocket消息出错:', error);
        }
      });
      
      this.hyperliquidWs.on('error', (error) => {
        console.error('Hyperliquid WebSocket错误:', error);
      });
      
      this.hyperliquidWs.on('close', () => {
        console.log('Hyperliquid WebSocket连接关闭');
        this.handleReconnect('hyperliquid');
      });
    } catch (error) {
      console.error('连接Hyperliquid WebSocket失败:', error);
      this.handleReconnect('hyperliquid');
    }
  }

  /**
   * 处理WebSocket重连
   * @param chain 区块链
   */
  private handleReconnect(chain: 'ethereum' | 'solana' | 'hyperliquid'): void {
    if (!this.isMonitoring) return;
    
    // 增加重连尝试次数
    this.reconnectAttempts[chain]++;
    
    // 如果超过最大尝试次数
    if (this.reconnectAttempts[chain] > this.maxReconnectAttempts) {
      console.log(`[${chain}] 超过最大重连尝试次数，停止重连`);
      return;
    }
    
    // 计算延迟时间（指数退避）
    const delay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts[chain] - 1), 60000);
    console.log(`[${chain}] 将在${delay / 1000}秒后尝试重连，尝试次数：${this.reconnectAttempts[chain]}/${this.maxReconnectAttempts}`);
    
    setTimeout(() => {
      if (!this.isMonitoring) return;
      
      console.log(`[${chain}] 尝试重新连接...`);
      switch (chain) {
        case 'ethereum':
          this.connectEthereumWebSocket();
          break;
        case 'solana':
          this.connectSolanaWebSocket();
          break;
        case 'hyperliquid':
          this.connectHyperliquidWebSocket();
          break;
      }
    }, delay);
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    this.transactionCache.clear();
    console.log('WebSocket监控资源已清理');
  }
}

// 导出单例
export default new WebSocketMonitor(); 