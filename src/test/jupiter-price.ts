import axios from 'axios';

// Jupiter API URLs
const JUPITER_PRICE_API = 'https://lite-api.jup.ag/price/v2';
const JUPITER_TOKEN_LIST_API = 'https://token.jup.ag/all';

// 常用代币地址
const SOL_MINT = 'So11111111111111111111111111111111111111112'; // 注意这是WSOL地址
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// 代币缓存，避免重复请求
const tokenCache: {[key: string]: any} = {};

/**
 * 通过符号查找代币地址
 */
async function getTokenAddressBySymbol(symbol: string): Promise<string | null> {
  try {
    // 检查缓存
    if (tokenCache[symbol.toUpperCase()]) {
      console.log(`[Jupiter] 从缓存获取代币地址: ${symbol} -> ${tokenCache[symbol.toUpperCase()].address}`);
      return tokenCache[symbol.toUpperCase()].address;
    }
    
    // 特殊处理SOL
    if (symbol.toUpperCase() === 'SOL') {
      console.log(`[Jupiter] SOL使用WSOL地址: ${SOL_MINT}`);
      return SOL_MINT;
    }
    
    console.log(`[Jupiter] 获取代币列表...`);
    const response = await axios.get(JUPITER_TOKEN_LIST_API);
    
    if (!response.data || !Array.isArray(response.data)) {
      console.error('[Jupiter] 获取代币列表失败: 无效响应');
      return null;
    }
    
    // 查找匹配的代币
    const token = response.data.find((t: any) => 
      t.symbol.toUpperCase() === symbol.toUpperCase() ||
      t.name.toUpperCase() === symbol.toUpperCase()
    );
    
    if (token) {
      console.log(`[Jupiter] 找到代币: ${token.symbol} (${token.name}) - ${token.address}`);
      
      // 缓存代币信息
      tokenCache[token.symbol.toUpperCase()] = token;
      
      return token.address;
    }
    
    console.log(`[Jupiter] 未找到代币: ${symbol}`);
    return null;
  } catch (error: any) {
    console.error('[Jupiter] 获取代币地址失败:', error.message);
    return null;
  }
}

/**
 * 获取代币价格
 */
async function getTokenPrice(tokenSymbol: string, baseSymbol: string = 'USDC'): Promise<number | null> {
  try {
    console.log(`[Jupiter] 获取价格: ${tokenSymbol}/${baseSymbol}`);
    
    // 获取代币地址
    const tokenAddress = await getTokenAddressBySymbol(tokenSymbol);
    if (!tokenAddress) {
      throw new Error(`未找到代币地址: ${tokenSymbol}`);
    }
    
    const baseAddress = await getTokenAddressBySymbol(baseSymbol);
    if (!baseAddress) {
      throw new Error(`未找到基础代币地址: ${baseSymbol}`);
    }
    
    console.log(`[Jupiter] 代币地址: ${tokenSymbol}=${tokenAddress}, ${baseSymbol}=${baseAddress}`);
    
    // 使用Jupiter Price API
    const response = await axios.get(JUPITER_PRICE_API, {
      params: {
        ids: tokenSymbol,
        vsToken: baseSymbol
      }
    });
    
    if (response.data && 
        response.data.data && 
        response.data.data[tokenSymbol] && 
        response.data.data[tokenSymbol].price) {
      const price = response.data.data[tokenSymbol].price;
      console.log(`[Jupiter] ${tokenSymbol}/${baseSymbol} 价格: ${price}`);
      return price;
    }
    
    // 如果上面的方法失败，尝试直接使用地址
    console.log(`[Jupiter] 尝试使用地址获取价格...`);
    
    const directResponse = await axios.get(JUPITER_PRICE_API, {
      params: {
        ids: tokenAddress,
        vsTokens: baseAddress
      }
    });
    
    if (directResponse.data && 
        directResponse.data.data && 
        directResponse.data.data[tokenAddress] && 
        directResponse.data.data[tokenAddress][baseAddress]) {
      const price = directResponse.data.data[tokenAddress][baseAddress];
      console.log(`[Jupiter] ${tokenSymbol}/${baseSymbol} 价格 (通过地址): ${price}`);
      return price;
    }
    
    console.log(`[Jupiter] 未找到 ${tokenSymbol}/${baseSymbol} 价格`);
    return null;
  } catch (error: any) {
    console.error(`[Jupiter] 获取价格失败:`, error.message);
    return null;
  }
}

/**
 * 搜索代币
 */
async function searchToken(query: string): Promise<void> {
  try {
    console.log(`[Jupiter] 搜索代币: ${query}`);
    
    const response = await axios.get(JUPITER_TOKEN_LIST_API);
    
    if (!response.data || !Array.isArray(response.data)) {
      console.error('[Jupiter] 获取代币列表失败: 无效响应');
      return;
    }
    
    // 搜索匹配的代币
    const matchingTokens = response.data.filter((t: any) => {
      const symbol = t.symbol.toLowerCase();
      const name = t.name.toLowerCase();
      const searchQuery = query.toLowerCase();
      
      return symbol.includes(searchQuery) || 
             name.includes(searchQuery) || 
             searchQuery.includes(symbol);
    }).slice(0, 10); // 限制结果数量
    
    if (matchingTokens.length > 0) {
      console.log(`[Jupiter] 找到 ${matchingTokens.length} 个匹配的代币:`);
      
      for (const token of matchingTokens) {
        console.log(`- ${token.symbol} (${token.name}): ${token.address}`);
        
        // 尝试获取价格
        try {
          const price = await getTokenPrice(token.symbol);
          if (price) {
            console.log(`  价格: ${price} USDC`);
          } else {
            console.log(`  价格: 未知`);
          }
        } catch (error) {
          console.log(`  价格: 获取失败`);
        }
      }
    } else {
      console.log(`[Jupiter] 未找到匹配的代币: ${query}`);
    }
  } catch (error: any) {
    console.error('[Jupiter] 搜索代币失败:', error.message);
  }
}

// 运行测试
async function runTests() {
  console.log('======= 开始测试 =======');
  
  // 测试获取价格
  await getTokenPrice('SOL');
  await getTokenPrice('BTC');
  await getTokenPrice('ETH');
  
  // 测试搜索代币
  const searchQuery = process.argv[2] || 'WIF';
  await searchToken(searchQuery);
  
  console.log('======= 测试完成 =======');
}

// 执行测试
runTests(); 