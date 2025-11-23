# GitHub Setup Instructions

Your WordPress AI Agent project is ready to be pushed to GitHub!

## Step 1: Create a GitHub Repository

1. Go to https://github.com/new
2. Create a new repository:
   - **Repository name**: `wordpress-ai-agent`
   - **Description**: Automated article generation, image creation, and Pinterest pin management for Parent Village Blog
   - **Visibility**: Choose Public or Private
   - **Do NOT initialize** with README, .gitignore, or license (we already have these)
3. Click "Create repository"

## Step 2: Connect Local Repository to GitHub

After creating the repository, GitHub will show you commands. Run these in your terminal:

```bash
# Replace <YOUR_USERNAME> with your actual GitHub username
git remote add origin https://github.com/<YOUR_USERNAME>/wordpress-ai-agent.git
git branch -M main
git push -u origin main
```

## Step 3: Verify Push

Check your GitHub repository URL - you should see all your files there!

## Important Security Notes

⚠️ **NEVER commit these files** (already in .gitignore):
- `.env` - Contains your OpenAI API key and WordPress credentials
- `generated_images/` - Temporary image files
- `pin_exports/` - Temporary CSV exports
- `saved_pins/` - Pin data
- `node_modules/` - Dependencies (use `npm install` instead)

## About the .env File

1. The `.env.example` file is in the repository as a template
2. When you clone this repo on another machine, copy it:
   ```bash
   cp .env.example .env
   ```
3. Then add your actual credentials

## Future Workflow

After initial setup:

```bash
# Make changes to your code
git add .
git commit -m "Your descriptive commit message"
git push
```

## Clone on Another Machine

To use this on another machine:

```bash
git clone https://github.com/<YOUR_USERNAME>/wordpress-ai-agent.git
cd wordpress-ai-agent
npm install
cp .env.example .env
# Edit .env with your credentials
npm run build
```

---

Questions? Check the main README.md for more information!
