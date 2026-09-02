# Shimmering DSH Plugin Library

[简体中文](README.md) · [English](README.en.md)

> **Shimmering-dsh-plugins** — third-party plugin collection for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) · group homepage
> Developed and maintained by [@ShanHaiFish](https://github.com/ShanHaiFish) · Repo: [ShanHaiFish/Shimmering-dsh-plugins](https://github.com/ShanHaiFish/Shimmering-dsh-plugins)

This is the index homepage of the **Shimmering DSH Plugin Library**: it aggregates every plugin, a short feature description, and one-line install commands.
**This repo only groups links — it does not host plugin source code.** Each plugin lives in its own repository with independent updates, tags, and releases.
Plugins are grouped via the GitHub topic [`dsh-plugin`](https://github.com/ShanHaiFish?tab=repositories&q=topic%3Adsh-plugin); a new plugin joins the index automatically once the topic is set.

## Plugin List

> Sort order: descending stars (alphabetical within the same star count), maintained manually.

| Plugin | Stars | Version | Description |
|---|---|---|---|
| [dsh-plugin-security-review](https://github.com/ShanHaiFish/dsh-plugin-security-review) | ![stars](https://img.shields.io/github/stars/ShanHaiFish/dsh-plugin-security-review?style=social) | v1.8.1 | Security-review gate for plugin installs: fail-safe review of `cordis_define`/`cordis_run` before `dsh plugin add` (security-first) |
| [dsh-check-for-updates](https://github.com/ShanHaiFish/dsh-check-for-updates) | ![stars](https://img.shields.io/github/stars/ShanHaiFish/dsh-check-for-updates?style=social) | v1.13.2 | DSH update checker: checks npm for the latest version on first open, bottom-left update popup + one-click **Update To** button |
| [dsh-plugin-manager-lite](https://github.com/ShanHaiFish/dsh-plugin-manager-lite) | ![stars](https://img.shields.io/github/stars/ShanHaiFish/dsh-plugin-manager-lite?style=social) | v0.1.1 | Third-party plugin manager: list / enable / disable / uninstall / check updates / one-click npm install & upgrade (Settings → Plugins → Third-party) |
| [dsh-theme-brick](https://github.com/ShanHaiFish/dsh-theme-brick) | ![stars](https://img.shields.io/github/stars/ShanHaiFish/dsh-theme-brick?style=social) | v0.2.1 | DSH theme (Brick): warm plaster & fired-clay accent, mortar hairlines — a pure token overlay with zero global CSS, on/off switch in Settings |
| [fexp-file-explorer](https://github.com/ShanHaiFish/fexp-file-explorer) | ![stars](https://img.shields.io/github/stars/ShanHaiFish/fexp-file-explorer?style=social) | v1.6.1 | Workspace file explorer in the left sidebar: browse dirs/files, preview files, open in OS file manager, add file references to the chat |

## Installation

Prerequisites:

- DeepSeek Harness (`dsh`) `0.1.1-rc.2`+ (npm latest; developer preview — fields may change). Plugin `peerDependencies` are aligned to this version as the baseline
- Node.js `>=18`

Using the `web` profile as an example (replace `--profile` for other profiles). All plugins are published on npm — install by package name:

```bash
# Plugin install security-review gate
dsh plugin --profile web add dsh-plugin-security-review

# DSH update checker
dsh plugin --profile web add dsh-check-for-updates

# Third-party plugin manager (install it first if you want to manage the rest from it)
dsh plugin --profile web add dsh-plugin-manager-lite

# Theme: Brick
dsh plugin --profile web add dsh-theme-brick

# Workspace file explorer
dsh plugin --profile web add fexp-file-explorer
```

Install a specific version (`@version`):

```bash
dsh plugin --profile web add dsh-check-for-updates@1.13.2
```

## General Notes

- ~~sent-msg-locator~~ (sent-message locator) has been retired and removed: **newer DSH client builds have this turn-locator capability built in**, so the third-party plugin is no longer needed.
- All plugins are **static bundle plugins** (`package.json` declares `dsh.bundle.patch` + a web UI client bundle).
- **Restart DSH** (e.g. `dsh web`) after installation for changes to take effect; the Host resolves and serves plugins from `~/.dsh/profiles/<profile>/node_modules/<package>/`.
- Plugins are independent of each other and can be combined freely; disable/uninstall via [dsh-plugin-manager-lite](https://github.com/ShanHaiFish/dsh-plugin-manager-lite) on the settings page.
- Each plugin is **updated and released independently**: check the [Releases](https://github.com/ShanHaiFish?tab=repositories&q=topic%3Adsh-plugin) of the corresponding repo for new versions; re-run its install command to upgrade.

## Feedback & Contributing

File issues and suggestions in the [corresponding repos](https://github.com/ShanHaiFish?tab=repositories&q=topic%3Adsh-plugin); for security matters see each repo's `SECURITY.md`.

## License

All plugins are MIT Licensed — see the `LICENSE` in each repo.