const { parentPort, workerData } = require('worker_threads');
const { setTimeout } = require('timers');
const axios = require('axios');

// 工作线程ID
const workerId = workerData?.workerId || 0;
let isRunning = false;

// 监控配置
const config = {
  minValueEth: 100, // 以太坊最小交易额 (ETH)
  minValueSol: 500, // Solana最小交易额 (SOL)
  minValueHyperliquid: 100000, // Hyperliquid最小交易额 (USD)
  interval: 5000, // 监控间隔 (毫秒)
};

// 区块链API端点
const API_ENDPOINTS = {
  ethereum: {
    url: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
    method: 'fetchEthereumTransactions'
  },
  solana: {
    url: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    method: 'fetchSolanaTransactions'
  },
  hyperliquid: {
    url: process.env.HYPERLIQUID_API_URL || 'https://api.hyperliquid.xyz',
    method: 'fetchHyperliquidTransactions'
  }
};

// 监听来自主线程的消息
parentPort.on('message', (message) => {
  if (message.type === 'start') {
    startMonitoring();
  } else if (message.type === 'stop') {
    stopMonitoring();
  } else if (message.type === 'config') {
    // 更新配置
    if (message.config) {
      Object.assign(config, message.config);
    }
  }
});

/**
 * 启动监控
 */
function startMonitoring() {
  if (isRunning) return;
  
  isRunning = true;
  console.log(`工作线程 ${workerId} 启动监控`);
  
  // 分配监控任务，不同线程监控不同区块链
  const chains = ['ethereum', 'solana', 'hyperliquid'];
  const myChain = chains[workerId % chains.length];
  
  // 启动对应链的监控
  monitorChain(myChain);
}

/**
 * 停止监控
 */
function stopMonitoring() {
  if (!isRunning) return;
  
  isRunning = false;
  console.log(`工作线程 ${workerId} 停止监控`);
}

/**
 * 监控特定区块链
 * @param {string} chain 区块链名称
 */
function monitorChain(chain) {
  if (!isRunning) return;
  
  console.log(`工作线程 ${workerId} 开始监控 ${chain}`);
  
  // 获取对应链的监控方法
  const method = API_ENDPOINTS[chain].method;
  if (typeof global[method] === 'function') {
    // 执行监控
    global[method]()
      .then(transactions => {
        if (transactions && transactions.length > 0) {
          // 发送交易到主线程
          for (const tx of transactions) {
            parentPort.postMessage({
              type: 'transaction',
              data: {
                chain,
                ...tx
              }
            });
          }
        }
      })
      .catch(error => {
        parentPort.postMessage({
          type: 'error',
          error: `监控 ${chain} 出错: ${error.message}`
        });
      })
      .finally(() => {
        if (isRunning) {
          // 继续监控
          setTimeout(() => monitorChain(chain), config.interval);
        }
      });
  } else {
    parentPort.postMessage({
      type: 'error',
      error: `工作线程 ${workerId} 不支持监控 ${chain}, 方法 ${method} 未定义`
    });
    
    // 尝试使用通用方法
    setTimeout(() => fetchTransactions(chain), config.interval);
  }
}

/**
 * 通用交易获取方法
 * @param {string} chain 区块链名称
 */
async function fetchTransactions(chain) {
  if (!isRunning) return;
  
  try {
    let transactions = [];
    
    if (chain === 'ethereum') {
      transactions = await fetchEthereumTransactions();
    } else if (chain === 'solana') {
      transactions = await fetchSolanaTransactions();
    } else if (chain === 'hyperliquid') {
      transactions = await fetchHyperliquidTransactions();
    }
    
    if (transactions && transactions.length > 0) {
      // 发送交易到主线程
      for (const tx of transactions) {
        parentPort.postMessage({
          type: 'transaction',
          data: {
            chain,
            ...tx
          }
        });
      }
    }
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      error: `通用监控 ${chain} 出错: ${error.message}`
    });
  }
  
  if (isRunning) {
    // 继续监控
    setTimeout(() => fetchTransactions(chain), config.interval);
  }
}

/**
 * 获取以太坊大额交易
 */
async function fetchEthereumTransactions() {
  try {
    // 简单实现，实际应使用Web3.js或ethers.js
    const apiUrl = API_ENDPOINTS.ethereum.url;
    const blockNumHex = await getLatestBlockNumber(apiUrl);
    
    if (!blockNumHex) return [];
    
    const blockInfo = await getBlockInfo(apiUrl, blockNumHex);
    
    if (!blockInfo || !blockInfo.transactions) return [];
    
    // 过滤大额交易
    return blockInfo.transactions
      .filter(tx => {
        const value = parseInt(tx.value, 16) / 1e18; // 转换为ETH
        return value >= config.minValueEth;
      })
      .map(tx => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to || 'Contract Creation',
        value: parseInt(tx.value, 16) / 1e18,
        timestamp: Math.floor(Date.now() / 1000)
      }));
  } catch (error) {
    console.error(`工作线程 ${workerId} 获取以太坊交易失败:`, error.message);
    return [];
  }
}

/**
 * 获取最新区块号
 */
async function getLatestBlockNumber(apiUrl) {
  try {
    const response = await axios.post(apiUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_blockNumber',
      params: []
    });
    
    if (response.data && response.data.result) {
      return response.data.result;
    }
    
    return null;
  } catch (error) {
    console.error(`工作线程 ${workerId} 获取最新区块号失败:`, error.message);
    return null;
  }
}

/**
 * 获取区块信息
 */
async function getBlockInfo(apiUrl, blockNumber) {
  try {
    const response = await axios.post(apiUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBlockByNumber',
      params: [blockNumber, true]
    });
    
    if (response.data && response.data.result) {
      return response.data.result;
    }
    
    return null;
  } catch (error) {
    console.error(`工作线程 ${workerId} 获取区块信息失败:`, error.message);
    return null;
  }
}

/**
 * 获取Solana大额交易
 */
async function fetchSolanaTransactions() {
  try {
    // 简单实现，实际应使用@solana/web3.js
    const apiUrl = API_ENDPOINTS.solana.url;
    
    const response = await axios.post(apiUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'getRecentBlockhash',
      params: []
    });
    
    // 此处仅返回模拟数据，实际应调用getConfirmedSignaturesForAddress2等方法
    // 然后解析每个交易的实际金额
    
    return [
      {
        hash: `solana-tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        from: `Sol${Math.random().toString(36).substring(2, 8)}`,
        to: `Sol${Math.random().toString(36).substring(2, 8)}`,
        value: config.minValueSol + Math.random() * 1000,
        timestamp: Math.floor(Date.now() / 1000)
      }
    ];
  } catch (error) {
    console.error(`工作线程 ${workerId} 获取Solana交易失败:`, error.message);
    return [];
  }
}

/**
 * 获取Hyperliquid大额交易
 */
async function fetchHyperliquidTransactions() {
  try {
    const apiUrl = `${API_ENDPOINTS.hyperliquid.url}/info/recentTrades`;
    
    const response = await axios.get(apiUrl);
    
    if (!response.data || !Array.isArray(response.data)) {
      return [];
    }
    
    // 过滤大额交易
    return response.data
      .filter(trade => {
        const value = trade.sz * trade.px; // 交易量*价格
        return value >= config.minValueHyperliquid;
      })
      .map(trade => ({
        hash: trade.tid || `hl-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        from: trade.maker || 'Unknown',
        to: trade.taker || 'Unknown',
        value: trade.sz * trade.px,
        timestamp: Math.floor(trade.time / 1000) || Math.floor(Date.now() / 1000),
        symbol: trade.coin,
        size: trade.sz,
        price: trade.px,
        side: trade.side === 'B' ? 'buy' : 'sell'
      }));
  } catch (error) {
    console.error(`工作线程 ${workerId} 获取Hyperliquid交易失败:`, error.message);
    return [];
  }
}

// 通知主线程工作线程已准备好
parentPort.postMessage({ type: 'ready', workerId }); 