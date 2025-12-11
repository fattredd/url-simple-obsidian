# Simple URL Cleaner for Obsidian

An Obsidian plugin that automatically processes urls when pasted into your notes.
It cleans tracking parameters, shortens links from supported platforms, and can
fetch page titles to create Markdown links - all configurable to your workflow.

`https://www.youtube.com/watch?v=IvYAqC0_HXI&si=WGLqEuXWNeFiCKOq&t=828`
becomes
`[youtu.be](https://youtu.be/IvYAqC0_HXI?t=828)`

## Features

- Automatic Processing: Intercepts URL pastes in the editor for immediate cleanup.
- Tracker Stripping: Removes UTM parameters, click IDs (fbclid, gclid), and other common tracking data.
- Platform Shortening: Converts supported urls to their clean, short forms:
  - YouTube: youtube.com/watch?v=... -> youtu.be/...
  - Amazon: amazon.com/gp/product/... -> amzn.com/gp/...
  - Twitter/X: twitter.com/... -> x.com/...
  - Reddit: reddit.com/.../comments/... -> redd.it/...
- Selective Formatting: Only auto-formats links from domains you specify; others just get cleaned.
- keyboard shortcut Controls: Use modifier keys while pasting to skip specific processing steps.

## Installation

### Manual Installation
- Clone this repository to your Obsidian plugins folder:- .obsidian/plugins/simple-url-cleaner
- Install dependencies: npm install
- Build the plugin: npm run build
- Enable "simple URL Cleaner" in Obsidian's Community Plugins settings.

## Usage

### Basic Pasting

Paste any URL normally (Ctrl+V/Cmd+V). The plugin automatically:
- Strips tracking parameters
- Shortens the URL if supported
- Formats as a Markdown link if the domain is in your auto-format list

### Keyboard shortcut Commands

Configure these in Obsidian's keyboard shortcut settings:
- Skip formatting: Ctrl/Cmd+Shift+V — Cleans trackers but doesn't fetch titles or format as Markdown
- Skip tracking: Alt+Shift+V — Formats as Markdown but doesn't remove trackers
- Skip both: Ctrl/Cmd+Alt+V — Pastes the raw URL unchanged

### Processing Selected Text

When text is selected, pasting a URL will replace the selection with the processed result.
Configuration

Access settings via Obsidian Settings -> Community plugins -> simple URL Cleaner.

## Core Settings:
- Enable/disable automatic processing on paste
- Toggle title fetching, tracker stripping, and URL shortening independently
- Set domains for auto-formatting (comma-separated, e.g., youtube.com,amazon.)

### Advanced:
- Add custom tracking parameters to strip
- All keyboard shortcuts are configurable through Obsidian's main keyboard shortcut settings

## How It Works

The plugin uses a rules-based system:
- Detection: Identifies urls from supported platforms using hostname and path patterns.
- Cleaning: Filters out known tracking parameters while preserving essential ones (like v for YouTube).
- Shortening: Reconstructs urls using platform-specific short domains.
- Formatting: Fetches page titles (if enabled) and creates Markdown links only for specified domains.
