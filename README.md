# Moony - Personal Wealth Manager

<div align="center">

A modern, privacy-focused personal finance management application built with Tauri, React, and Rust.

**All your financial data stays on your device.**

</div>

## Features

- 📊 **Dashboard** - Get a comprehensive overview of your net worth and portfolio performance
- 💰 **Stock Investments** - Track stocks with live price updates via Marketstack API
- 🪙 **Cryptocurrency** - Monitor crypto holdings with CoinGecko integration
- 🏠 **Real Estate** - Manage property portfolio with photo galleries and valuation tracking
- 💵 **Savings Accounts** - Track savings with zone-based goal management
- 📈 **Bonds** - Monitor fixed-income investments
- 💳 **Loans** - Track liabilities and loan payments
- 🛡️ **Insurance** - Keep track of insurance policies
- 📦 **Other Assets** - Manage miscellaneous assets (art, collectibles, etc.)
- 💱 **Multi-currency Support** - Automatic currency conversion with ECB exchange rates
- 🔒 **Local-first & Encrypted** - SQLCipher encrypted database, your data never leaves your device
- 🌍 **Internationalization** - Multi-language support (i18n)
- 🌙 **Dark/Light Mode** - Beautiful UI with theme support

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **TailwindCSS** for styling
- **shadcn/ui** components (Radix UI primitives)
- **TanStack Query** for data fetching and caching
- **Recharts** for data visualization
- **wouter** for routing
- **react-hook-form** + **zod** for form validation
- **Framer Motion** for animations

### Backend
- **Tauri 2** - Cross-platform desktop app framework
- **Rust** - Backend logic and data processing
- **SQLite with SQLCipher** - Encrypted local database
- **reqwest** - HTTP client for external API calls

## Prerequisites

Before running the application, make sure you have the following installed:

### All Platforms
- [Node.js](https://nodejs.org/) (v18 or later) - JavaScript runtime
- [Rust](https://www.rust-lang.org/tools/install) (latest stable) - Backend language

---

### Windows

1. **Install Rust**
   - Download and run the installer from [rustup.rs](https://win.rustup.rs/x86_64)
   - Follow the installation prompts
   - Restart your terminal after installation

2. **Install Microsoft C++ Build Tools** (required by Rust)
   - Download from [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - During installation, select **"Desktop development with C++"** workload
   - This includes MSVC compiler and Windows SDK

3. **Install WebView2** (usually pre-installed on Windows 10/11)
   - If not present, download from [Microsoft Edge WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

4. **Verify installation**
   ```powershell
   rustc --version
   cargo --version
   node --version
   ```

---

### macOS

1. **Install Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```

2. **Install Rust**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source $HOME/.cargo/env
   ```

3. **Verify installation**
   ```bash
   rustc --version
   cargo --version
   node --version
   ```

---

### Linux (Ubuntu/Debian)

1. **Install system dependencies**
   ```bash
   sudo apt update
   sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
   ```

2. **Install Rust**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source $HOME/.cargo/env
   ```

3. **Verify installation**
   ```bash
   rustc --version
   cargo --version
   node --version
   ```

For other Linux distributions, see [Tauri Linux Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites#setting-up-linux).

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/fiiles/moony-tauri.git
   cd moony-tauri
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run tauri dev
   ```

4. **Build for production**
   ```bash
   npm run tauri build
   ```

## Configuration

### API Keys (Optional)

For live stock and crypto price updates, you can configure API keys in the Settings page:

- **Marketstack API** - For stock prices and dividends ([Get API Key](https://marketstack.com/))
- **CoinGecko API** - For cryptocurrency prices (optional, works without key with rate limits)

> **Note**: API keys are stored securely in the local encrypted database. They are never transmitted anywhere except to the respective API services.

## Project Structure

```
moony-tauri/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── i18n/               # Internationalization
│   ├── lib/                # Utilities and API client
│   ├── pages/              # Page components
│   └── utils/              # Helper functions
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri command handlers
│   │   ├── db/             # Database migrations and setup
│   │   ├── models/         # Data models
│   │   └── services/       # Business logic
│   └── tauri.conf.json     # Tauri configuration
├── shared/                 # Shared types and utilities
└── public/                 # Static assets
```

## Privacy & Security

- 🔐 **Local-only storage** - All data is stored locally on your device
- 🛡️ **SQLCipher encryption** - Database is encrypted with AES-256
- 🚫 **No cloud sync** - Your financial data never leaves your computer
- 🔑 **Password protected** - Access is protected by your account password

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

## License

Copyright © 2025 Filip Král. All rights reserved.

This software is **open source for non-commercial use only**:
- ✅ Free for personal use
- ✅ Source code viewable and modifiable for learning
- ❌ Commercial use strictly prohibited without permission

See [LICENSE](./LICENSE) for full terms.

---

<div align="center">
Made with ❤️ using Tauri + React + Rust
</div>
