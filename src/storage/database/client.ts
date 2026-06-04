import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './shared/schema';

// 数据库连接池优化配置
const connectionString = process.env.DATABASE_URL || process.env.PGDATABASE_URL;

const pool = new Pool({
  connectionString,
  // 最大连接数：生产环境50，开发环境20
  max: process.env.COZE_PROJECT_ENV === 'PROD' ? 50 : 20,
  // 最小连接数：保持一定数量的空闲连接
  min: 5,
  // 连接空闲超时：30秒后释放
  idleTimeoutMillis: 30000,
  // 连接获取超时：5秒
  connectionTimeoutMillis: 5000,
});

// 连接池健康检查
pool.on('error', (err) => {
  console.error('数据库连接池错误:', err.message);
});

pool.on('connect', () => {
  console.log('新的数据库连接已建立');
});

export const db = drizzle(pool, { schema });

export { schema };

// 获取连接池状态
export function getPoolStatus() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}
