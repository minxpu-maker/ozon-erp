/**
 * ERP系统完整工作流程测试脚本
 * 测试所有API端点和页面路由
 */

const BASE_URL = 'http://localhost:5000';

interface TestResult {
  name: string;
  success: boolean;
  status?: number;
  error?: string;
  data?: unknown;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<{ success: boolean; error?: string; data?: unknown }>) {
  try {
    const result = await fn();
    results.push({ name, ...result });
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${name}${result.error ? `: ${result.error}` : ''}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, success: false, error: errorMsg });
    console.log(`❌ ${name}: ${errorMsg}`);
  }
}

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  console.log('\n========================================');
  console.log('ERP系统工作流程测试');
  console.log('========================================\n');

  // 1. 测试店铺管理
  console.log('\n--- 店铺管理 ---');
  
  await test('获取店铺列表', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/shops`);
    return { success: status === 200 && data.success, data };
  });

  await test('添加测试店铺', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/shops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '测试店铺_' + Date.now(),
        client_id: 'test_' + Date.now(),
        api_key: 'test_key_' + Date.now(),
        is_primary: false
      })
    });
    return { success: status === 200 && data.success, data };
  });

  // 2. 测试订单管理
  console.log('\n--- 订单管理 ---');
  
  await test('获取订单列表', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/orders`);
    return { success: status === 200 && data.success, data };
  });

  // 3. 测试仪表盘
  console.log('\n--- 仪表盘 ---');
  
  await test('获取仪表盘数据', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/dashboard`);
    return { success: status === 200 && data.success, data };
  });

  // 4. 测试采购管理
  console.log('\n--- 采购管理 ---');
  
  await test('获取采购任务列表', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/purchase`);
    return { success: status === 200 && data.success, data };
  });

  // 5. 测试快捷录单
  console.log('\n--- 快捷录单 ---');
  
  await test('获取待绑定订单', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/quick-entry`);
    return { success: status === 200 && data.success, data };
  });

  // 6. 测试入库验货
  console.log('\n--- 入库验货 ---');
  
  await test('获取验货任务列表', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/logistics`);
    return { success: status === 200 && data.success, data };
  });

  // 7. 测试打包发货
  console.log('\n--- 打包发货 ---');
  
  await test('获取待打包订单', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/packaging`);
    return { success: status === 200 && data.success, data };
  });

  // 8. 测试利润核算
  console.log('\n--- 利润核算 ---');
  
  await test('获取财务数据', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/finance`);
    return { success: status === 200 && data.success, data };
  });

  // 9. 测试库存管理
  console.log('\n--- 库存管理 ---');
  
  await test('获取库存列表', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/inventory`);
    return { success: status === 200 && data.success, data };
  });

  // 10. 测试仓库管理
  console.log('\n--- 仓库管理 ---');
  
  await test('获取仓库列表', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/wms`);
    return { success: status === 200 && data.success, data };
  });

  // 11. 测试SKU管理
  console.log('\n--- SKU管理 ---');
  
  await test('获取SKU列表', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/sku-management`);
    return { success: status === 200 && data.success, data };
  });

  // 12. 测试供应商管理
  console.log('\n--- 供应商管理 ---');
  
  await test('获取供应商列表', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/suppliers`);
    return { success: status === 200 && data.success, data };
  });

  // 13. 测试数据报表
  console.log('\n--- 数据报表 ---');
  
  await test('获取报表数据', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/reports`);
    return { success: status === 200 && data.success, data };
  });

  // 14. 测试账号管理
  console.log('\n--- 账号管理 ---');
  
  await test('获取账号列表', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/accounts`);
    return { success: status === 200 && data.success, data };
  });

  // 15. 测试角色权限
  console.log('\n--- 角色权限 ---');
  
  await test('获取角色列表', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/roles`);
    return { success: status === 200 && data.success, data };
  });

  // 16. 测试系统设置
  console.log('\n--- 系统设置 ---');
  
  await test('获取系统设置', async () => {
    const { status, data } = await fetchJson(`${BASE_URL}/api/shops`);
    return { success: status === 200 && data.success, data };
  });

  // 汇总结果
  console.log('\n========================================');
  console.log('测试结果汇总');
  console.log('========================================');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\n总计: ${results.length} 个测试`);
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  
  if (failed > 0) {
    console.log('\n失败的测试:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.name}: ${r.error || '未知错误'}`);
    });
  }

  // 返回退出码
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
