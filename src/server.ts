import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

const dev = process.env.COZE_PROJECT_ENV !== 'PROD';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '5000', 10);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    // 请求超时处理（30秒）
    const timeout = setTimeout(() => {
      if (!res.writableEnded) {
        res.statusCode = 504;
        res.end('Gateway Timeout');
      }
    }, 30000);
    
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    } finally {
      clearTimeout(timeout);
    }
  });
  
  // 服务器优化配置
  server.keepAliveTimeout = 65 * 1000;  // 65秒 keep-alive
  server.headersTimeout = 66 * 1000;     // 66秒 headers 超时
  
  server.once('error', err => {
    console.error(err);
    process.exit(1);
  });
  server.listen(port, () => {
    console.log(
      `> Server listening at http://${hostname}:${port} as ${
        dev ? 'development' : process.env.COZE_PROJECT_ENV
      }`,
    );
  });
});
