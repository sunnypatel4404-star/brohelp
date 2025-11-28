# Quick Reference Card

## 🚀 Common Commands

### Generate Content (Most Used)
```bash
npm run generate-article "Your topic"      # ⭐ Generate article + image
npm run generate-pins "Topic" [post_id]    # Create 5 pin variations
```

### Check Progress
```bash
npm run dashboard                          # Quick summary
npm run dashboard pins                     # Detailed pin report
npm run server                             # Web dashboard
```

### Other
```bash
npm run publish-draft [post_id]            # Publish WordPress draft
npm run build                              # Build project
```

---

## 📝 Complete Workflow

```
1️⃣  Generate Article
    npm run generate-article "Topic"
    ↓
    → Saves image to: generated_images/
    → Creates WordPress draft
    → Shows edit link

2️⃣  Review & Edit (Optional)
    Click WordPress edit link
    Make any changes
    Leave as draft or publish

3️⃣  Generate Pins
    npm run generate-pins "Topic" [post_id]
    ↓
    → Creates 5 pin variations
    → Saves to: saved_pins/
    → Shows suggested tags

4️⃣  Upload Pins to Pinterest (Manual)
    For each of 5 variations:
    • Use suggested title
    • Use suggested description
    • Upload your article image
    • Add suggested tags
    • Point to blog post URL

5️⃣  Monitor Progress
    npm run dashboard
    ↓
    See pin status and statistics
```

---

## 📊 Dashboard Quick Guide

| Command | What It Shows |
|---------|---------------|
| `npm run dashboard` | Summary & recent activity |
| `npm run dashboard pins` | All pins by status |
| `npm run dashboard stats` | Analytics & productivity |
| `npm run dashboard timeline` | 30-day activity chart |
| `npm run server` | Visual web dashboard |

---

## 🎯 Daily To-Do

- [ ] Check dashboard: `npm run dashboard`
- [ ] Generate article: `npm run generate-article "topic"`
- [ ] Generate pins: `npm run generate-pins "topic" [id]`
- [ ] Upload pins to Pinterest (manual, 5 variations)
- [ ] Check next day's progress: `npm run dashboard`

---

## 💡 Pro Tips

- **Batch generation**: Generate 3-5 articles at once
- **Reuse pins**: Each article = 5 pin variations
- **Check stats**: `npm run dashboard stats` weekly
- **Monitor costs**: Visit https://platform.openai.com/account/usage
- **Peak times**: Upload to Pinterest 9am-3pm

---

## 🔧 Configuration Files

| File | What It Controls |
|------|------------------|
| `.env` | Your credentials |
| `src/config/botConfig.ts` | Article writing style |
| `src/config/pinConfig.ts` | Pinterest settings |

---

## 📂 Important Folders

| Folder | Purpose |
|--------|---------|
| `generated_images/` | Your generated images |
| `saved_pins/` | Your pin drafts (JSON) |
| `src/services/` | Core functionality |
| `src/commands/` | CLI commands |

---

## ⚠️ Quick Troubleshooting

**"Missing OPENAI_API_KEY"**
```bash
# Check .env file has the key
cat .env
```

**"WordPress upload failed"**
```bash
# Verify credentials in .env
# Check WordPress.com site is accessible
curl https://parentvillage.blog/xmlrpc.php
```

**"Port 3000 in use" (web dashboard)**
```bash
# Kill process on port 3000
lsof -i :3000
kill -9 <PID>
```

---

## 📈 Cost Per Article

| Item | Cost |
|------|------|
| ChatGPT (article) | ~$0.02 |
| DALL-E (image) | ~$0.10 |
| **Total** | **~$0.12** |

**Monthly:** ~1-10 articles = $1-12/month

---

## 🎓 Documentation Map

- **Quick start**: This file
- **Step-by-step**: USAGE_GUIDE.md
- **Dashboard help**: DASHBOARD_GUIDE.md
- **Full details**: PROJECT_SUMMARY.md
- **Configuration**: BOT_CONFIG.md
- **Pinterest setup**: PINTEREST_IMPLEMENTATION.md
- **Main README**: README.md

---

## 🚀 First Steps

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Edit .env with your API keys

# 3. Build
npm run build

# 4. Test
npm run generate-article "Test topic"

# 5. Check dashboard
npm run dashboard

# 6. View web dashboard
npm run server
# Open http://localhost:3000
```

---

## 🎯 Success Indicators

✅ Article generated with emoji title
✅ Image saved to generated_images/
✅ WordPress draft created
✅ 5 pin variations generated
✅ Suggested tags showing
✅ Dashboard shows new pins

---

## 💬 Common Questions

**Q: How long does article generation take?**
A: 30-60 seconds (ChatGPT + DALL-E)

**Q: Can I edit the generated article?**
A: Yes! Edit in WordPress admin

**Q: Are the images unique each time?**
A: Yes, DALL-E generates new variations

**Q: Do I have to upload pins manually?**
A: Currently yes (Pinterest API limitations)

**Q: Can I change the writing style?**
A: Yes, edit `src/config/botConfig.ts`

---

## 🔐 Security Checklist

- [ ] `.env` file created and configured
- [ ] API keys added to `.env`
- [ ] `.env` NOT committed to git
- [ ] WordPress application password used (not main password)
- [ ] OpenAI billing set up

---

## 📞 Quick Help

**See all commands:**
```bash
npm run dashboard help
```

**Check API usage:**
```bash
# OpenAI: https://platform.openai.com/account/usage
```

**View your content:**
```bash
# Generated images
ls generated_images/

# Pin drafts
ls saved_pins/
```

---

**🎉 You're ready to go! Start with:**
```bash
npm run generate-article "Your first topic"
```

