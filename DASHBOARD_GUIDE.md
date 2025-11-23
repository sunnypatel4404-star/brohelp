# Dashboard Guide - Parent Village Content Manager

## Overview

Your WordPress AI Agent includes a powerful dashboard system with two interfaces:

1. **CLI Dashboard** - Terminal-based (quick access, real-time)
2. **Web Dashboard** - Browser-based (visual, comprehensive)

Both show the same data but with different interfaces optimized for different workflows.

## CLI Dashboard

### Quick Access

View your content dashboard directly in the terminal:

```bash
npm run dashboard [command]
```

### Available Commands

#### 1. Summary (Default)
```bash
npm run dashboard
npm run dashboard summary
```

Shows:
- Pin statistics (total, drafts, approved, published)
- Generated images count
- 5 most recent items
- Quick action links

**Example Output:**
```
════════════════════════════════════════════════════════════
  📊 PARENT VILLAGE - CONTENT DASHBOARD
════════════════════════════════════════════════════════════

📍 PIN STATISTICS
  📌 Total Pins: 2
  📝 Drafts: 2 pins
  ✅ Approved: 0 pins
  🚀 Published: 0 pins

📍 IMAGE GENERATION
  🖼️  Generated Images: 3

📍 RECENT ACTIVITY
  1. 📌 Tips for toddler sleep routines
     [DRAFT] • 11/22/2025
     5 variations
  ...
```

#### 2. Pin Report
```bash
npm run dashboard pins
```

Shows:
- All draft pins with details
- All approved pins with dates
- All published pins with dates

Use this to:
- Review pins waiting for approval
- See publication history
- Track pin status changes

#### 3. Statistics
```bash
npm run dashboard stats
```

Shows:
- Total pins generated
- Completion rate (published ÷ total)
- Pins by topic
- 7-day activity chart

Use this to:
- Monitor productivity
- See which topics are most generated
- Track activity over time

#### 4. Timeline
```bash
npm run dashboard timeline
```

Shows:
- 30-day activity visualization
- Pins generated per day
- Activity trends

Use this to:
- Identify your productivity patterns
- Plan batch content generation
- Spot peak activity periods

#### 5. Full Report
```bash
npm run dashboard full
```

Shows everything (summary + pins + stats + timeline)

## Web Dashboard

### Starting the Server

```bash
npm run server
```

**Output:**
```
╔════════════════════════════════════════════════════════╗
║   🌐 PARENT VILLAGE DASHBOARD SERVER                   ║
╚════════════════════════════════════════════════════════╝

✅ Server is running!

📊 Open in your browser: http://localhost:3000
```

### Accessing the Dashboard

1. Start the server: `npm run server`
2. Open browser: `http://localhost:3000`
3. Dashboard auto-refreshes every 10 seconds

### Dashboard Features

The web dashboard displays:

**Top Cards (Statistics)**
- 📌 Total Pins - All pins across all statuses
- 📝 Draft Pins - Waiting for approval
- ✅ Approved Pins - Ready to publish
- 🚀 Published Pins - Live on Pinterest
- 🖼️ Generated Images - Total images created

**Pin Sections**
- **Draft Pins** - Pins needing approval with details
- **Approved Pins** - Ready to upload to Pinterest
- **Published Pins** - Already live on Pinterest

Each pin shows:
- Article title
- Pin status (color-coded badge)
- Number of variations
- Creation date

**Activity Timeline**
- 7-day activity chart
- Visual representation of pins created per day
- Helps identify your content creation patterns

### Dashboard Design

- **Responsive** - Works on desktop, tablet, mobile
- **Real-time** - Auto-refreshes every 10 seconds
- **Color-coded** - Visual status indicators
- **Interactive** - Hover effects and smooth transitions

**Color Scheme:**
- Draft: Yellow badge (#fff3cd)
- Approved: Green badge (#d4edda)
- Published: Blue badge (#d1ecf1)

## Workflow Integration

### Typical Content Creation Workflow

1. **Generate Article**
   ```bash
   npm run generate-article "Your topic"
   ```

2. **Check Dashboard**
   ```bash
   npm run dashboard summary
   ```
   See your new draft in "Recent Activity"

3. **Generate Pins**
   ```bash
   npm run generate-pins "Your topic" 522
   ```

4. **Monitor Progress**
   ```bash
   npm run dashboard pins
   ```
   See the new pins in the "Draft Pins" section

5. **Approve Pins** (coming soon)
   ```bash
   npm run approve-pins [pin_id]
   ```

6. **Check Status**
   ```bash
   npm run dashboard
   ```
   Approved pins now show in stats

## API Endpoints (Web Dashboard)

The web server also provides REST API endpoints:

### Get Full Dashboard Data
```bash
curl http://localhost:3000/api/dashboard
```

**Returns:** All pins, images, and statistics

### Get Statistics Only
```bash
curl http://localhost:3000/api/stats
```

**Returns:** Pin stats and 7-day timeline

### Get All Pins
```bash
curl http://localhost:3000/api/pins
```

**Returns:** Array of all SavedPin objects

### Get Generated Images
```bash
curl http://localhost:3000/api/images
```

**Returns:** Array of image filenames

### Example API Response (stats)
```json
{
  "stats": {
    "articles": {
      "total": 0,
      "drafts": 0,
      "published": 0
    },
    "pins": {
      "total": 2,
      "draft": 2,
      "approved": 0,
      "published": 0
    },
    "images": {
      "total": 3
    }
  },
  "timeline": [
    {
      "date": "2025-11-23",
      "count": 2
    },
    {
      "date": "2025-11-22",
      "count": 0
    }
  ]
}
```

## Best Practices

### Daily Check-in
Use the CLI dashboard each morning:
```bash
npm run dashboard summary
```

This takes 2 seconds and shows you:
- How many pins are waiting approval
- Recent activity
- Next actions

### Weekly Review
Use the web dashboard for comprehensive review:
```bash
npm run server
# Visit http://localhost:3000 in browser
```

Spend 5 minutes reviewing:
- Pin completion rate
- Activity trends
- Topics you've covered

### Performance Tracking
Check statistics weekly:
```bash
npm run dashboard stats
```

Monitor:
- Total pins generated
- Pins per topic
- Week-over-week growth

## Customization

### Want to add more metrics?

Edit: `src/services/dashboardService.ts`

Add new methods like:
```typescript
getTotalWordsGenerated(): number { }
getAverageVariationsPerArticle(): number { }
getTopicsRanking(): Record<string, number> { }
```

### Want to change the web dashboard design?

Edit: `src/server/dashboardServer.ts`

Modify the HTML/CSS in the `getDashboardHTML()` function.

### Want to export data?

The dashboard service already supports CSV export (future feature - coming soon).

## Troubleshooting

### "Cannot find module dashboardService"
- Rebuild: `npm run build`
- Check file exists: `ls src/services/dashboardService.ts`

### Web dashboard shows no data
- Check pins saved: `ls saved_pins/`
- Check images generated: `ls generated_images/`
- Verify server running: `npm run server`

### Server won't start on port 3000
- Port already in use: `lsof -i :3000`
- Kill process: `kill -9 <PID>`
- Or use different port (edit src/server/dashboardServer.ts line 4)

### Dashboard not auto-refreshing
- Check browser console for errors (F12)
- Manually refresh browser (F5)
- Restart server: `npm run server`

## Complete Command Reference

```bash
# Content Generation
npm run generate-article "topic"           # Generate article + image
npm run generate-image "topic"             # Generate image only
npm run generate-pins "topic" [post_id]    # Generate pin variations

# Dashboard Views
npm run dashboard                          # Summary (default)
npm run dashboard summary                  # Summary view
npm run dashboard pins                     # Pin report
npm run dashboard stats                    # Statistics
npm run dashboard timeline                 # Activity timeline
npm run dashboard full                     # Everything
npm run dashboard help                     # Show help

# Web Dashboard
npm run server                             # Start web server (http://localhost:3000)

# WordPress Management
npm run publish-draft [post_id]            # Publish WordPress draft
```

## Next Features (Coming Soon)

- [ ] Pin approval workflow
- [ ] Quick pin approval from dashboard
- [ ] CSV export
- [ ] Scheduled reports
- [ ] Analytics integration
- [ ] Dark mode
- [ ] Mobile app
- [ ] Slack notifications

## Tips for Productivity

1. **Use CLI for quick checks** - `npm run dashboard` is fastest
2. **Use web dashboard for detailed review** - Better for analysis
3. **Set up browser bookmark** - Bookmark `http://localhost:3000`
4. **Keep terminal open** - Run `npm run server` in background terminal
5. **Check daily** - Makes it easy to stay on top of your content

Happy content creating! 📊
