import { jupiterService } from '../services/jupiter.service';

/**
 * Jupiter服务测试
 */
async function testJupiterService() {
  console.log('===== 测试 Jupiter 服务 =====');

  // 测试1: 获取SOL价格
  console.log('\n测试1: 获取SOL价格');
  const solPrice = await jupiterService.getTokenPrice('SOL', 'USDC');
  console.log(`SOL/USDC 价格: ${solPrice}`);

  // 测试2: 获取WIF价格
  console.log('\n测试2: 获取WIF价格');
  const wifPrice = await jupiterService.getTokenPrice('WIF', 'USDC');
  console.log(`WIF/USDC 价格: ${wifPrice}`);

  // 测试3: 搜索代币
  console.log('\n测试3: 搜索代币');
  const searchTerm = process.argv[2] || 'WIF';
  console.log(`搜索: "${searchTerm}"`);
  const searchResults = await jupiterService.searchToken(searchTerm);
  
  if (searchResults.length > 0) {
    console.log(`找到 ${searchResults.length} 个结果:`);
    searchResults.forEach((token, index) => {
      console.log(`${index + 1}. ${token.symbol} (${token.name})`);
      console.log(`   地址: ${token.address}`);
      console.log(`   价格: ${token.price !== null ? `${token.price} USDC` : '未知'}`);
      console.log('');
    });
  } else {
    console.log(`未找到匹配的代币: ${searchTerm}`);
  }

  // 测试4: 使用交易API获取价格
  console.log('\n测试4: 使用交易API获取价格');
  try {
    // 这里我们传递一个不太常见的代币进行测试
    const customToken = process.argv[3] || 'BONK';
    const customPrice = await jupiterService.getTokenPrice(customToken, 'USDC');
    console.log(`${customToken}/USDC 价格: ${customPrice}`);
  } catch (error: any) {
    console.error(`获取价格失败: ${error.message}`);
  }

  console.log('\n===== 测试完成 =====');
}

// 运行测试
testJupiterService()
  .catch(err => {
    console.error('测试失败:', err);
  }); 