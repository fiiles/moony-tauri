# Automatic Updates Guide

Moony supports automatic updates via GitHub Releases. This guide covers the complete process from development to deployment.

---

## Table of Contents

1. [For End Users](#for-end-users)
2. [Initial One-Time Setup](#initial-one-time-setup-for-developers)
3. [Complete Release Process](#complete-release-process)
4. [How It All Works](#how-it-all-works)
5. [Troubleshooting](#troubleshooting)

---

## For End Users

### How Updates Work

1. **Automatic Check**: The app checks for updates ~5 seconds after you log in
2. **Notification**: A dialog appears showing the new version and release notes
3. **One-Click Update**: Click "Update Now" to download and install
4. **Restart**: The app relaunches automatically with the new version

### macOS Users ⚠️

Since Moony is not signed with an Apple Developer Certificate, macOS blocks unsigned apps. **After each update**, run this command in Terminal:

```bash
xattr -cr /Applications/Moony.app
```

Then open the app normally. You only need to do this once per update.

---

## Initial One-Time Setup (For Developers)

Complete these steps **once** before your first release with auto-updates.

### Step 1: Generate Signing Keys

The updater requires cryptographic signatures to verify updates are authentic.

```bash
npm run tauri signer generate -- -w ~/.tauri/moony.key
```

You will see output like:
```
Please enter a password to protect the secret key:
Password:

Your keypair was generated successfully
Private: /Users/you/.tauri/moony.key
Public: dW50cnVzdGVkIGNvbT...base64...==
```

> ⚠️ **IMPORTANT**: 
> - Save the **private key** file (`~/.tauri/moony.key`) securely
> - Copy the **public key** (the long base64 string) for the next step
> - If you lose the private key, users will need to reinstall the app manually

### Step 2: Configure Public Key in App

Open `src-tauri/tauri.conf.json` and update the `plugins.updater` section:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbT...YOUR_ACTUAL_PUBLIC_KEY_HERE...==",
      "endpoints": [
        "https://github.com/filipkral/Moony/releases/latest/download/latest.json"
      ]
    }
  }
}
```

Replace:
- `YOUR_ACTUAL_PUBLIC_KEY_HERE` with your generated public key
- `filipkral/Moony` with your actual GitHub username/repo

### Step 3: Add Secrets to GitHub Repository

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add:

| Secret Name | Value |
|-------------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Entire contents of `~/.tauri/moony.key` file |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The password you entered when generating keys |

### Step 4: Commit Configuration

```bash
git add src-tauri/tauri.conf.json
git commit -m "chore: configure auto-updater with public key"
git push origin main
```

---

## Complete Release Process

Follow this process every time you want to release a new version.

### Step 1: Finish Your Feature

Complete all development work, testing, and code review.

```bash
# Ensure all changes are committed
git status
git add .
git commit -m "feat: your new feature description"
```

### Step 2: Update Version Numbers

Update the version in **three files** (they must match):

**package.json** (line ~4):
```json
{
  "name": "moony",
  "version": "0.2.0",
  ...
}
```

**src-tauri/Cargo.toml** (line ~3):
```toml
[package]
name = "moony"
version = "0.2.0"
```

**src-tauri/tauri.conf.json** (line ~4):
```json
{
  "productName": "Moony",
  "version": "0.2.0",
  ...
}
```

> 💡 **Version Format**: Use [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH)
> - MAJOR: Breaking changes
> - MINOR: New features (backwards compatible)
> - PATCH: Bug fixes

### Step 3: Commit Version Bump

```bash
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: bump version to 0.2.0"
git push origin main
```

### Step 4: Create a Git Tag

The release workflow triggers on tags starting with `v`:

```bash
git tag v0.2.0
git push origin v0.2.0
```

### Step 5: Wait for GitHub Actions

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Watch the "Release" workflow running
4. Wait for all 4 platform builds to complete (macOS ARM, macOS Intel, Windows, Linux)

This typically takes 15-30 minutes.

### Step 6: Review the Draft Release

1. Go to **Releases** in your repository
2. You'll see a new **Draft** release
3. Click to edit it
4. Review:
   - Release notes (auto-generated from workflow)
   - Attached files (should include installers for all platforms + `latest.json`)
5. Optionally add more details to the release notes

### Step 7: Publish the Release

Click **Publish release** to make it public.

### Step 8: Verify Update Detection

On a machine with an older version installed:

1. Open Moony
2. Wait ~5 seconds after login
3. An update dialog should appear showing the new version
4. Click "Update Now" to test the full flow

---

## How It All Works

### Build Process (GitHub Actions)

```
┌─────────────────────────────────────────────────────────┐
│  You push tag v0.2.0                                    │
└───────────────────────────┬─────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│  GitHub Actions runs release.yml                        │
│  - Builds app for macOS (ARM + Intel), Windows, Linux   │
│  - Signs each update with your private key              │
│  - Generates latest.json with version + signatures      │
└───────────────────────────┬─────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│  GitHub Release created with:                           │
│  - Moony_0.2.0_aarch64.dmg (macOS Apple Silicon)        │
│  - Moony_0.2.0_x64.dmg (macOS Intel)                    │
│  - Moony_0.2.0_x64-setup.exe (Windows)                  │
│  - Moony_0.2.0_amd64.deb (Linux)                        │
│  - latest.json (version manifest)                       │
└─────────────────────────────────────────────────────────┘
```

### Update Detection (In App)

```
┌─────────────────────────────────────────────────────────┐
│  User opens Moony (running v0.1.0)                      │
└───────────────────────────┬─────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│  5 seconds after startup, app fetches:                  │
│  github.com/.../releases/latest/download/latest.json    │
└───────────────────────────┬─────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│  latest.json contains:                                  │
│  {                                                      │
│    "version": "0.2.0",                                  │
│    "notes": "Release notes...",                         │
│    "platforms": {                                       │
│      "darwin-aarch64": { "url": "...", "signature": ""} │
│      ...                                                │
│    }                                                    │
│  }                                                      │
└───────────────────────────┬─────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│  App compares: 0.2.0 > 0.1.0 → Update available!        │
│  Shows dialog with version and release notes            │
└───────────────────────────┬─────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│  User clicks "Update Now"                               │
│  - Downloads update for their platform                  │
│  - Verifies signature with public key                   │
│  - Installs update                                      │
│  - Relaunches app                                       │
└─────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Build Failures

**"TAURI_SIGNING_PRIVATE_KEY not set"**
- Go to GitHub → Settings → Secrets → Actions
- Verify `TAURI_SIGNING_PRIVATE_KEY` secret exists
- Ensure the entire key file content is pasted (including headers)

**Build times out**
- GitHub Actions has a 6-hour limit
- Try re-running the failed job

### Updates Not Detected

**App doesn't show update dialog**
1. Check that `latest.json` exists in the latest release
2. Verify the endpoint URL in `tauri.conf.json` is correct
3. Check browser console (F12) for network errors
4. Ensure the new version is higher than the installed version

**"Failed to check for updates" error**
- Check internet connection
- Verify GitHub releases are public (not private repo)
- The endpoint URL might be wrong

### Signature Verification Fails

**"Signature mismatch" or similar errors**
- The public key in `tauri.conf.json` doesn't match the private key used. to sign
- Solution: Ensure you're using the correct key pair
- If keys were regenerated, users need to manually download the new version

### macOS Issues

**"App is damaged and can't be opened"**
```bash
xattr -cr /Applications/Moony.app
```

**App won't open after update**
- Same fix: run the `xattr` command above
- This is required after each update for unsigned apps

---

## Quick Reference

### Release Checklist

- [ ] All features complete and tested
- [ ] Version bumped in `package.json`, `Cargo.toml`, `tauri.conf.json`
- [ ] Changes committed and pushed
- [ ] Git tag created: `git tag vX.Y.Z && git push origin vX.Y.Z`
- [ ] GitHub Actions completed successfully
- [ ] Draft release reviewed and published
- [ ] Update tested on at least one platform

### Key Files

| File | Purpose |
|------|---------|
| `~/.tauri/moony.key` | Private signing key (keep secret!) |
| `src-tauri/tauri.conf.json` | Public key + endpoint URL |
| `.github/workflows/release.yml` | Build and release automation |
| `latest.json` (in release) | Version manifest for update detection |
