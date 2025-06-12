import axios from 'axios';

/**
 * 通过币名称获取价格
 * 使用CoinGecko API，支持大多数知名加密货币
 */
async function getTokenPrice(tokenName: string, currency: string = 'usd') {
  try {
    console.log(`获取 ${tokenName} 价格...`);
    
    // CoinGecko API支持通过币名称查询
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: tokenName.toLowerCase(), // CoinGecko使用小写名称
        vs_currencies: currency.toLowerCase()
      },
      timeout: 10000
    });
    
    // 检查响应
    if (response.data && response.data[tokenName.toLowerCase()] && 
        response.data[tokenName.toLowerCase()][currency.toLowerCase()]) {
      const price = response.data[tokenName.toLowerCase()][currency.toLowerCase()];
      console.log(`[CoinGecko] ${tokenName}/${currency.toUpperCase()} 价格: ${price}`);
      return price;
    } else {
      console.log(`[CoinGecko] 未找到 ${tokenName} 价格`);
      
      // 如果找不到，可能是因为币名不匹配，尝试获取所有支持的币列表
      console.log('尝试获取支持的币列表...');
      const coinsListResponse = await axios.get('https://api.coingecko.com/api/v3/coins/list');
      
      // 搜索相似名称
      const similarCoins = coinsListResponse.data.filter((coin: any) => {
        const name = coin.name.toLowerCase();
        const symbol = coin.symbol.toLowerCase();
        const query = tokenName.toLowerCase();
        return name.includes(query) || symbol.includes(query) || query.includes(symbol);
      }).slice(0, 5); // 只显示前5个结果
      
      if (similarCoins.length > 0) {
        console.log('找到可能匹配的币:');
        similarCoins.forEach((coin: any) => {
          console.log(`- ${coin.name} (${coin.symbol}): id=${coin.id}`);
        });
        
        // 尝试使用第一个匹配的币
        const firstMatch = similarCoins[0];
        console.log(`尝试使用 ${firstMatch.name} (${firstMatch.symbol})...`);
        
        const retryResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
          params: {
            ids: firstMatch.id,
            vs_currencies: currency.toLowerCase()
          },
          timeout: 10000
        });
        
        if (retryResponse.data && retryResponse.data[firstMatch.id] && 
            retryResponse.data[firstMatch.id][currency.toLowerCase()]) {
          const price = retryResponse.data[firstMatch.id][currency.toLowerCase()];
          console.log(`[CoinGecko] ${firstMatch.name}/${currency.toUpperCase()} 价格: ${price}`);
          return price;
        }
      }
      
      return null;
    }
  } catch (error: any) {
    console.error(`获取 ${tokenName} 价格失败:`, error.message);
    return null;
  }
}

/**
 * 通过币符号获取价格
 * 这个函数专门处理通过币符号查询的情况
 */
async function getPriceBySymbol(symbol: string, currency: string = 'usd') {
  try {
    console.log(`通过符号获取 ${symbol} 价格...`);
    
    // 常见币符号到CoinGecko ID的映射
    const symbolToId: {[key: string]: string} = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'SOL': 'solana',
      'USDT': 'tether',
      'USDC': 'usd-coin',
      'BNB': 'binancecoin',
      'XRP': 'ripple',
      'ADA': 'cardano',
      'DOGE': 'dogecoin',
      'MATIC': 'matic-network',
      'DOT': 'polkadot',
      'SHIB': 'shiba-inu',
      'AVAX': 'avalanche-2',
      'LTC': 'litecoin',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'ATOM': 'cosmos',
      'XLM': 'stellar',
      'WIF': 'dogwifhat',
      'BONK': 'bonk',
      'JUP': 'jupiter-exchange',
      'PYTH': 'pyth-network',
      'JTO': 'jito-governance',
    };
    
    // 检查是否有直接映射
    const upperSymbol = symbol.toUpperCase();
    if (symbolToId[upperSymbol]) {
      return await getTokenPrice(symbolToId[upperSymbol], currency);
    }
    
    // 如果没有直接映射，尝试搜索
    console.log(`符号 ${symbol} 没有直接映射，尝试搜索...`);
    
    // 获取所有支持的币列表
    const coinsListResponse = await axios.get('https://api.coingecko.com/api/v3/coins/list');
    
    // 查找匹配的符号
    const matchingCoins = coinsListResponse.data.filter((coin: any) => 
      coin.symbol.toLowerCase() === symbol.toLowerCase()
    );
    
    if (matchingCoins.length > 0) {
      console.log(`找到 ${matchingCoins.length} 个匹配的币`);
      
      // 如果有多个匹配，选择市值最高的一个
      if (matchingCoins.length > 1) {
        console.log('多个匹配，尝试获取市值数据...');
        
        try {
          // 获取前100个币的市值数据
          const marketResponse = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
            params: {
              vs_currency: currency,
              order: 'market_cap_desc',
              per_page: 250,
              page: 1
            }
          });
          
          // 找出市值最高的匹配币
          let highestMarketCapCoin = null;
          
          for (const marketCoin of marketResponse.data) {
            for (const matchingCoin of matchingCoins) {
              if (marketCoin.id === matchingCoin.id) {
                if (!highestMarketCapCoin || marketCoin.market_cap > highestMarketCapCoin.market_cap) {
                  highestMarketCapCoin = marketCoin;
                }
              }
            }
          }
          
          if (highestMarketCapCoin) {
            console.log(`选择市值最高的 ${highestMarketCapCoin.name} (${highestMarketCapCoin.symbol})`);
            return await getTokenPrice(highestMarketCapCoin.id, currency);
          }
        } catch (error) {
          console.error('获取市值数据失败:', error);
        }
      }
      
      // 如果没有找到市值最高的或者只有一个匹配，使用第一个
      console.log(`使用 ${matchingCoins[0].name} (${matchingCoins[0].id})`);
      return await getTokenPrice(matchingCoins[0].id, currency);
    }
    
    console.log(`未找到符号为 ${symbol} 的币`);
    return null;
  } catch (error: any) {
    console.error(`通过符号获取 ${symbol} 价格失败:`, error.message);
    return null;
  }
}

// 运行测试
async function runTests() {
  console.log('======= 开始测试 =======');
  
  // 测试通过名称获取价格
  await getTokenPrice('bitcoin');
  await getTokenPrice('ethereum');
  await getTokenPrice('solana');
  
  // 测试通过符号获取价格
  await getPriceBySymbol('BTC');
  await getPriceBySymbol('ETH');
  await getPriceBySymbol('SOL');
  
  // 测试WIF代币
  await getPriceBySymbol('WIF');
  
  // 测试自定义币名
  const customToken = process.argv[2];
  if (customToken) {
    console.log(`\n测试自定义代币: ${customToken}`);
    await getPriceBySymbol(customToken);
  }
  
  console.log('======= 测试完成 =======');
}

// 执行测试
runTests(); 