# Contributing to Moony

Thank you for your interest in Moony! This document describes how the project is
actually developed and how you can contribute.

## How This Project Is Developed

Moony is maintained by a **solo maintainer working with AI agents**, using
**trunk-based development on `main`** — small, frequent commits, no long-lived
branches. There is no formal review queue; quality is enforced by a tiered set
of automated gates and a documented workflow.

The authoritative process lives in
[`docs/standards/workflow.md`](./docs/standards/workflow.md). In short:

- **Tiered workflow** — features (new command, table, page, or domain, or
  changes over ~150 lines) go through brainstorm → spec (`docs/specs/`) →
  plan (`docs/plans/`) → TDD → code review → verification. Small fixes (bug
  fix, copy change, config tweak) need TDD + gates + verification only.
- **Gates:**
  - **pre-commit** (fast, <10s): lint-staged (staged-file ESLint/Prettier),
    `npm run typecheck`, `cargo fmt --check`
  - **pre-push** (heavy): `npm test`, `cargo clippy -- -D warnings`, `cargo test`
  - **CI** (authoritative): everything above plus generated-types drift check
    and `cargo audit`
- **Coding standards** live in [`docs/standards/`](./docs/standards/)
  (Rust backend, TypeScript frontend, type contract, testing, i18n).
- **Architecture decisions** are recorded as ADRs in
  [`docs/architecture/decisions/`](./docs/architecture/decisions/).

## How to Contribute

External contributions are welcome, with the caveat that this is primarily a
personal project:

- 🐛 **Bug reports** — the most valuable contribution (see below)
- ✨ **Feature ideas** — open an issue for discussion before writing code
- 📝 **Documentation fixes**
- 🌍 **Translations and i18n improvements**

If you want to submit code, open an issue first to align on the approach, then
open a pull request against `main`. Describe what changed, why, and how you
tested it — there is no required template. Your change must pass the same gates
listed above (CI runs them on every PR).

## Licensing of Contributions

Moony is licensed under the **GNU Affero General Public License v3.0** (see
[LICENSE](./LICENSE)). By submitting a contribution you agree that:

1. Your contribution is licensed under the AGPL-3.0, the same terms as the rest
   of the project.
2. You additionally grant Filip Král a perpetual, worldwide, non-exclusive,
   royalty-free, irrevocable license to use, modify, and redistribute your
   contribution **under other license terms as well**, including proprietary or
   commercial licenses.

Point 2 keeps dual licensing possible — without it, every past contributor would
have to be asked for permission before Moony could ever be offered under terms
other than the AGPL.

## Development Setup

### Prerequisites

- **Node.js** v18 or later
- **Rust** (latest stable)
- Platform-specific dependencies (see [README.md](./README.md#prerequisites))

### Commands

```bash
# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev

# Run frontend only (for UI development)
npm run dev

# Build for production
npm run tauri build

# Quality gates (run before committing)
npm run lint && npm run typecheck && npm test
cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test
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
├── docs/                   # Standards, architecture, ADRs, specs, plans
└── public/                 # Static assets
```

## Code Style

Follow the standards in [`docs/standards/`](./docs/standards/). Highlights:

- **TypeScript/React** — typed components, TanStack Query for data fetching,
  shadcn/ui components, react-hook-form + zod for forms, all user-facing
  strings translated in both locales (`docs/standards/i18n.md`)
- **Rust** — commands in `commands/`, business logic in `services/`, proper
  `Result` error handling, tests per `docs/standards/testing.md`
- **CSS** — TailwindCSS utilities, dark and light theme support

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/)
specification:

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `build`, `ci`.

Examples:

```
feat(investments): add dividend tracking feature
fix(crypto): resolve price update race condition
docs(readme): update installation instructions
refactor(auth): simplify password validation logic
```

Keep commits small and focused — one logical change per commit.

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

## Suggesting Features

For new features:

1. **Check existing issues** to avoid duplicates
2. **Open a feature request issue** before implementing
3. **Describe the feature** and its use case
4. **Wait for discussion** before starting work

## Questions?

If you have questions about contributing, feel free to:

- Open a discussion on GitHub
- Check existing issues and discussions

---

Thank you for contributing to Moony! 🌙
