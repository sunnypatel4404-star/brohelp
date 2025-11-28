import * as http from 'http';
import { DashboardService } from '../services/dashboardService';

const PORT = 3000;
const dashboardService = new DashboardService();

/**
 * Start the dashboard web server
 */
export function startDashboardServer(): void {
  const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
      return;
    }

    try {
      switch (req.url) {
        case '/':
          serveHTML(res);
          break;

        case '/api/dashboard': {
          const data = dashboardService.getDashboardData();
          res.writeHead(200);
          res.end(JSON.stringify(data, null, 2));
          break;
        }

        case '/api/stats': {
          const stats = {
            stats: dashboardService.getDashboardData().stats,
            timeline: dashboardService.getActivityTimeline(7)
          };
          res.writeHead(200);
          res.end(JSON.stringify(stats, null, 2));
          break;
        }

        case '/api/pins': {
          const pins = dashboardService.getDashboardData().allPins;
          res.writeHead(200);
          res.end(JSON.stringify(pins, null, 2));
          break;
        }

        case '/api/images': {
          const images = dashboardService.getDashboardData().generatedImages;
          res.writeHead(200);
          res.end(JSON.stringify(images, null, 2));
          break;
        }

        default:
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      res.writeHead(500);
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      );
    }
  });

  server.listen(PORT, () => {
    console.log(`\n🌐 Dashboard server running at http://localhost:${PORT}`);
    console.log(`📊 Open in browser to view your content dashboard\n`);
  });
}

/**
 * Serve the dashboard HTML
 */
function serveHTML(res: http.ServerResponse): void {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.writeHead(200);
  res.end(getDashboardHTML());
}

/**
 * Get the dashboard HTML
 */
function getDashboardHTML(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Parent Village - Content Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      text-align: center;
      color: white;
      margin-bottom: 40px;
    }

    header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }

    header p {
      font-size: 1.1em;
      opacity: 0.9;
    }

    .dashboard {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .card {
      background: white;
      border-radius: 12px;
      padding: 25px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      transition: transform 0.3s, box-shadow 0.3s;
    }

    .card:hover {
      transform: translateY(-5px);
      box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
    }

    .card-title {
      font-size: 0.9em;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 15px;
    }

    .card-value {
      font-size: 2.5em;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 10px;
    }

    .card-subtitle {
      font-size: 0.9em;
      color: #666;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
    }

    .stat-row:last-child {
      border-bottom: none;
    }

    .stat-label {
      color: #666;
    }

    .stat-value {
      font-weight: bold;
      color: #333;
    }

    .section {
      background: white;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 20px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    }

    .section-title {
      font-size: 1.5em;
      color: #333;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #667eea;
    }

    .pin-item {
      padding: 15px;
      border-left: 4px solid #667eea;
      background: #f8f9ff;
      border-radius: 4px;
      margin-bottom: 15px;
    }

    .pin-title {
      font-weight: bold;
      color: #333;
      margin-bottom: 5px;
    }

    .pin-meta {
      font-size: 0.85em;
      color: #999;
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.8em;
      font-weight: bold;
    }

    .badge-draft {
      background: #fff3cd;
      color: #856404;
    }

    .badge-approved {
      background: #d4edda;
      color: #155724;
    }

    .badge-published {
      background: #d1ecf1;
      color: #0c5460;
    }

    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #999;
    }

    .empty-state-icon {
      font-size: 3em;
      margin-bottom: 15px;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: white;
    }

    .loading::after {
      content: '';
      display: inline-block;
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    footer {
      text-align: center;
      color: white;
      padding: 20px;
      opacity: 0.8;
    }

    .timeline {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 15px;
    }

    .timeline-bar {
      text-align: center;
      flex: 1;
      min-width: 40px;
    }

    .timeline-date {
      font-size: 0.75em;
      color: #999;
      margin-top: 5px;
    }

    .bar {
      width: 100%;
      background: #667eea;
      border-radius: 4px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 0.8em;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📊 Parent Village Dashboard</h1>
      <p>Your Content & Pin Management Hub</p>
    </header>

    <div id="loading" class="loading">Loading dashboard...</div>

    <div id="dashboard" style="display: none;">
      <div class="dashboard">
        <div class="card">
          <div class="card-title">📌 Total Pins</div>
          <div class="card-value" id="total-pins">0</div>
          <div class="card-subtitle">across all statuses</div>
        </div>

        <div class="card">
          <div class="card-title">📝 Draft Pins</div>
          <div class="card-value" id="draft-pins">0</div>
          <div class="card-subtitle">waiting for approval</div>
        </div>

        <div class="card">
          <div class="card-title">✅ Approved Pins</div>
          <div class="card-value" id="approved-pins">0</div>
          <div class="card-subtitle">ready to publish</div>
        </div>

        <div class="card">
          <div class="card-title">🚀 Published Pins</div>
          <div class="card-value" id="published-pins">0</div>
          <div class="card-subtitle">live on Pinterest</div>
        </div>

        <div class="card">
          <div class="card-title">🖼️ Generated Images</div>
          <div class="card-value" id="total-images">0</div>
          <div class="card-subtitle">for articles</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">📌 Draft Pins</div>
        <div id="draft-list"></div>
      </div>

      <div class="section">
        <div class="section-title">✅ Approved Pins</div>
        <div id="approved-list"></div>
      </div>

      <div class="section">
        <div class="section-title">🚀 Published Pins</div>
        <div id="published-list"></div>
      </div>

      <div class="section">
        <div class="section-title">📈 Activity (7 Days)</div>
        <div id="timeline"></div>
      </div>
    </div>
  </div>

  <footer>
    <p>Parent Village Content Dashboard • Auto-refreshes every 10 seconds</p>
  </footer>

  <script>
    async function loadDashboard() {
      try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();

        // Update stats
        document.getElementById('total-pins').textContent = data.stats.pins.total;
        document.getElementById('draft-pins').textContent = data.stats.pins.draft;
        document.getElementById('approved-pins').textContent = data.stats.pins.approved;
        document.getElementById('published-pins').textContent = data.stats.pins.published;
        document.getElementById('total-images').textContent = data.stats.images.total;

        // Update pin lists
        updatePinList('draft-list', data.allPins.filter(p => p.status === 'draft'));
        updatePinList('approved-list', data.allPins.filter(p => p.status === 'approved'));
        updatePinList('published-list', data.allPins.filter(p => p.status === 'published'));

        // Show dashboard
        document.getElementById('loading').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
      } catch (error) {
        console.error('Error loading dashboard:', error);
        document.getElementById('loading').innerHTML = '<p>Error loading dashboard. Make sure the server is running.</p>';
      }
    }

    function updatePinList(elementId, pins) {
      const element = document.getElementById(elementId);
      if (pins.length === 0) {
        element.innerHTML = '<div class="empty-state"><div class="empty-state-icon">—</div><p>No pins in this category</p></div>';
        return;
      }

      element.innerHTML = pins
        .map(pin => {
          const statusBadge = \`<span class="badge badge-\${pin.status}">\${pin.status.toUpperCase()}</span>\`;
          const date = new Date(pin.createdAt).toLocaleDateString();
          return \`
            <div class="pin-item">
              <div class="pin-title">\${pin.articleTitle}</div>
              <div class="pin-meta">
                <span>\${statusBadge}</span>
                <span>\${pin.variations.length} variations</span>
                <span>\${date}</span>
              </div>
            </div>
          \`;
        })
        .join('');
    }

    // Load on page load
    loadDashboard();

    // Refresh every 10 seconds
    setInterval(loadDashboard, 10000);
  </script>
</body>
</html>
  `;
}

// Export for use in other modules
export { PORT };
