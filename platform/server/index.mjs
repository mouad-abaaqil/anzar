import { createApp } from './app.mjs';
const app = createApp();
const port = Number(process.env.PORT || 8787);
app.server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`SRM-SM API · http://localhost:${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { app.close().finally(() => process.exit(0)); });
