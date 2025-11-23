import dotenv from 'dotenv';
import { startDashboardServer, PORT } from '../server/dashboardServer';

dotenv.config();

console.log(`
╔════════════════════════════════════════════════════════╗
║   🌐 PARENT VILLAGE DASHBOARD SERVER                   ║
╚════════════════════════════════════════════════════════╝

Starting dashboard server...
`);

startDashboardServer();

console.log(`
✅ Server is running!

📊 Open in your browser: http://localhost:${PORT}

The dashboard displays:
  • Total pins generated
  • Pin status breakdown (draft/approved/published)
  • Recent activity
  • Generated images
  • Activity timeline

Auto-refreshes every 10 seconds.

Press Ctrl+C to stop the server.
`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down server...');
  process.exit(0);
});
