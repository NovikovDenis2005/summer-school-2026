import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 4000);

createApp().listen(PORT, () => {
  console.log(`[apex-karting] API готов: http://localhost:${PORT}/api`);
});
