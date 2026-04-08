import express from 'express';
import { createServer } from 'http';
import next from 'next';
import { initSocketServer } from './server/socket-server';
import { serverAdapter } from './lib/bullboard';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const nextApp = next({ dev, hostname, port });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const expressApp = express();

  // BullBoard — queue/worker monitoring dashboard at /admin/queues
  // Protect with basic auth if BULLBOARD_USER and BULLBOARD_PASS are set
  const bullUser = process.env.BULLBOARD_USER;
  const bullPass = process.env.BULLBOARD_PASS;
  if (bullUser && bullPass) {
    expressApp.use('/admin/queues', (req, res, next) => {
      const auth = req.headers.authorization;
      if (auth) {
        const [, encoded] = auth.split(' ');
        const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
        if (user === bullUser && pass === bullPass) return next();
      }
      res.setHeader('WWW-Authenticate', 'Basic realm="BullBoard"');
      res.status(401).end('Unauthorized');
    });
  }
  expressApp.use('/admin/queues', serverAdapter.getRouter());

  // All other requests handled by Next.js
  expressApp.use((req: express.Request, res: express.Response) => {
    return handle(req, res);
  });

  const httpServer = createServer(expressApp);
  initSocketServer(httpServer);

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> BullBoard at http://${hostname}:${port}/admin/queues`);
  });
});
