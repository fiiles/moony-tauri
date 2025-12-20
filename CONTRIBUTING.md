# Contributing to Moony

Thank you for your interest in contributing to Moony! This document provides guidelines and information for contributors.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

Please be respectful and considerate in all interactions. We expect all contributors to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community and project

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/moony-tauri.git
   cd moony-tauri
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/fiiles/moony-tauri.git
   ```

## How to Contribute

### Types of Contributions Welcome

- 🐛 Bug fixes
- ✨ New features (please discuss first via issue)
- 📝 Documentation improvements
- 🌍 Translations and i18n improvements
- ♿ Accessibility improvements
- 🎨 UI/UX enhancements
- 🧪 Test coverage improvements

## Development Setup

### Prerequisites

- **Node.js** v18 or later
- **Rust** (latest stable)
- Platform-specific dependencies (see [README.md](./README.md#prerequisites))

### Installation

```bash
# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev

# Run frontend only (for UI development)
npm run dev

# Build for production
npm run tauri build
```

### Project Structure

```
moony-tauri/
├── src/                    # React frontend (TypeScript)
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── i18n/               # Internationalization
│   ├── lib/                # Utilities and API client
│   ├── pages/              # Page components
│   └── utils/              # Helper functions
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri command handlers
│   │   ├── db/             # Database migrations
│   │   ├── models/         # Data models
│   │   └── services/       # Business logic
│   └── tauri.conf.json     # Tauri configuration
├── shared/                 # Shared types and calculations
└── public/                 # Static assets
```

## Code Style Guidelines

### TypeScript/React (Frontend)

- Use **TypeScript** for all new code
- Follow existing patterns for components and hooks
- Use **shadcn/ui** components where possible
- Use **TanStack Query** for data fetching
- Use **react-hook-form** with **zod** for forms
- Keep components focused and reusable
- Use translations for all user-facing strings via `i18next`

```tsx
// ✅ Good: typed, uses hooks, translated
const MyComponent: React.FC<{ title: string }> = ({ title }) => {
  const { t } = useTranslation();
  return <h1>{t('common.title')}</h1>;
};
```

### Rust (Backend)

- Follow standard Rust conventions
- Use meaningful variable and function names
- Add documentation comments for public functions
- Handle errors properly with `Result` types
- Keep commands in `commands/` and business logic in `services/`

```rust
// ✅ Good: documented, proper error handling
/// Fetches the user's investment portfolio
pub fn get_portfolio(user_id: i64) -> Result<Portfolio, AppError> {
    // implementation
}
```

### CSS/Styling

- Use **TailwindCSS** utility classes
- Follow existing patterns in `src/index.css`
- Support both dark and light themes
- Ensure responsive design

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

### Examples

```
feat(investments): add dividend tracking feature
fix(crypto): resolve price update race condition
docs(readme): update installation instructions
refactor(auth): simplify password validation logic
```

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style guidelines

3. **Test your changes**:
   - Run the app in development mode
   - Test affected features manually
   - Ensure no TypeScript/Rust errors

4. **Commit your changes** using conventional commit messages

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** against the `main` branch

7. **Fill out the PR template** with:
   - Description of changes
   - Related issue numbers
   - Screenshots (for UI changes)
   - Testing performed

8. **Address review feedback** promptly

### PR Checklist

- [ ] Code follows the project's style guidelines
- [ ] Self-reviewed the code for obvious issues
- [ ] Added/updated translations if adding user-facing strings
- [ ] Tested changes in development mode
- [ ] No TypeScript or Rust compilation errors

## Reporting Bugs

When reporting bugs, please include:

1. **Clear title** describing the issue
2. **Steps to reproduce** the bug
3. **Expected behavior** vs **actual behavior**
4. **Environment info**:
   - Operating system and version
   - Node.js version (`node --version`)
   - Rust version (`rustc --version`)
5. **Screenshots** if applicable
6. **Error messages** from console/logs

### Bug Report Template

```markdown
**Describe the bug**
A clear description of the bug.

**To Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g., macOS 14.0, Windows 11]
- Node.js: [e.g., 20.10.0]
- Rust: [e.g., 1.74.0]
```

## Suggesting Features

For new features:

1. **Check existing issues** to avoid duplicates
2. **Open a feature request issue** before implementing
3. **Describe the feature** and its use case
4. **Wait for discussion** before starting work

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Other solutions or features you've considered.

**Additional context**
Any other context or screenshots.
```

## Questions?

If you have questions about contributing, feel free to:

- Open a discussion on GitHub
- Check existing issues and discussions

---

Thank you for contributing to Moony! 🌙
