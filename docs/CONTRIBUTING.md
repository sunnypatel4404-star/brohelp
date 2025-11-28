# Contributing to WordPress AI Agent

Thank you for your interest in improving this project!

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy environment template: `cp .env.example .env`
4. Add your credentials to `.env`
5. Build: `npm run build`

## Project Structure

```
src/
├── commands/         # CLI entry points
├── services/         # Business logic & API integrations
├── config/          # Configuration templates
└── server/          # Web server code
```

## Making Changes

### Code Style
- Use TypeScript for all code
- Follow existing naming conventions
- Add comments for complex logic
- Keep functions focused and single-purpose

### Testing Changes
Before pushing, test:

```bash
npm run build                          # Compiles without errors
npm run generate-article "test topic"  # Test article generation
npm run review-pins list               # Test pin management
```

### Commit Messages
Use clear, descriptive commit messages:

```bash
git commit -m "Fix: featured image upload in WordPress service"
git commit -m "Feature: add support for carousel pins"
git commit -m "Refactor: improve ChatGPT prompt engineering"
```

## Areas for Enhancement

Potential improvements:
- [ ] Add support for automatic publishing
- [ ] Create scheduled article generation
- [ ] Add pin performance analytics
- [ ] Multi-language support
- [ ] Alternative image generators
- [ ] Content scheduling
- [ ] Draft editing interface
- [ ] Integration with other platforms

## Reporting Issues

When reporting bugs, include:
1. Error message or description
2. Steps to reproduce
3. Expected vs actual behavior
4. Your environment (Node version, OS, etc.)

## Pull Request Process

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Test thoroughly
4. Commit with clear messages
5. Push to your fork
6. Create pull request with description

## Need Help?

- Check README.md for usage
- Review existing code for examples
- Consult the USAGE_GUIDE.md for workflow

---

Happy coding! 🚀
