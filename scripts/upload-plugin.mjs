import { S3Storage } from 'coze-coding-dev-sdk';
import { readFileSync } from 'fs';

async function main() {
  const storage = new S3Storage({
    endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
    bucketName: process.env.COZE_BUCKET_NAME,
    region: 'cn-beijing',
  });

  const fileContent = readFileSync('./public/ozon-extension.tar.gz');
  const key = await storage.uploadFile({
    fileContent,
    fileName: 'ozon-extension/ozon-extension.tar.gz',
    contentType: 'application/gzip',
  });

  const url = await storage.generatePresignedUrl({ key, expireTime: 604800 });
  console.log('下载链接:', url);
}

main().catch(console.error);
