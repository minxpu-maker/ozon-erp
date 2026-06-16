/**
 * AES-256-CBC 加解密工具
 * 用于加密存储敏感信息（如API密钥）
 */

import crypto from 'crypto';

// 开发环境fallback key（32字节hex = 64字符）
const DEV_FALLBACK_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

/**
 * 获取加密密钥
 * 生产环境从环境变量读取，开发环境使用固定key
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    }
    console.warn('[Crypto] Warning: ENCRYPTION_KEY not set, using fallback key (development only)');
    return DEV_FALLBACK_KEY;
  }
  
  // 确保key是有效的64字符hex（32字节）
  if (!/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  
  return key;
}

/**
 * AES-256-CBC 加密
 * @param text 明文
 * @returns base64编码的密文（包含IV）
 */
export function encrypt(text: string): string {
  const key = Buffer.from(getEncryptionKey(), 'hex');
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  // 将IV拼接到密文前面（IV + ciphertext）
  return iv.toString('base64') + ':' + encrypted;
}

/**
 * AES-256-CBC 解密
 * @param cipherText 格式：base64(iv):base64(ciphertext)
 * @returns 明文
 */
export function decrypt(cipherText: string): string {
  const [ivPart, encryptedPart] = cipherText.split(':');
  
  if (!ivPart || !encryptedPart) {
    throw new Error('Invalid cipher text format');
  }
  
  const key = Buffer.from(getEncryptionKey(), 'hex');
  const iv = Buffer.from(ivPart, 'base64');
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  
  let decrypted = decipher.update(encryptedPart, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * 验证密钥格式是否正确
 */
export function isValidEncryptionKey(key: string): boolean {
  return /^[a-f0-9]{64}$/i.test(key);
}
