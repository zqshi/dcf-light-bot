const { startApp } = require('./app/start');

async function main() {
  const app = await startApp();
  const signals = ['SIGINT', 'SIGTERM'];

  for (const signal of signals) {
    process.on(signal, async () => {
      await app.shutdown();
      process.exit(0);
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
