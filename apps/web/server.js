const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { client } = require('@repo/database/client');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize the Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });

  // --- GRACEFUL SHUTDOWN SEQUENCE ---
  const shutdown = async (signal) => {
    console.log(`\n[${signal}] Graceful shutdown initiated...`);

    // Fallback: force exit if graceful shutdown hangs
    const forceExit = setTimeout(() => {
      console.error('Graceful shutdown timed out (10s). Forcing exit.');
      process.exit(1);
    }, 10000);
    forceExit.unref();

    // Step A: Stop accepting new HTTP requests
    server.close(async (err) => {
      if (err) {
        console.error('Error closing HTTP server:', err);
      } else {
        console.log('HTTP server closed. No longer accepting new connections.');
      }

      // Step B: Close Database gracefully
      try {
        console.log('Closing database connection pool...');
        // Wait up to 5 seconds for queries to finish before killing connection
        await client.end({ timeout: 5 });
        console.log('Database connection closed cleanly.');
      } catch (dbErr) {
        console.error('Error during database shutdown:', dbErr);
      }

      // Step C: Exit
      console.log('Graceful shutdown complete. Exiting process.');
      clearTimeout(forceExit);
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});
