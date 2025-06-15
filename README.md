# SnapCoder CLI

Command-line interface for taking website screenshots - AI agent friendly version of SnapCoder Chrome extension.

## Installation

```bash
# Global installation (recommended)
npm install -g @frontmatters/snapcoder-cli

# Or locally in your project
npm install @frontmatters/snapcoder-cli
```

## Usage

### Taking a single screenshot

Screenshots are saved by default in the `./snapcoder/` subdirectory of your current working directory.

```bash
# Full page screenshot (saved in ./snapcoder/)
snapcoder capture https://example.com

# Visible area screenshot
snapcoder capture https://example.com --mode visible

# Custom output path
snapcoder capture https://example.com --output my-screenshot.png

# Custom browser size
snapcoder capture https://example.com --width 1280 --height 720

# Selection area screenshot
snapcoder capture https://example.com --mode selection --selection "100,100,800,600"
```

### Batch screenshots

```bash
# Create urls.txt with one URL per line
echo "https://example.com" > urls.txt
echo "https://google.com" >> urls.txt

# Run batch capture (defaults to ./snapcoder/)
snapcoder batch urls.txt

# Or with custom directory
snapcoder batch urls.txt --output-dir ./my-screenshots
```

### Options

- `--mode <mode>`: Screenshot mode (`visible`, `fullpage`, `selection`) - default: `fullpage`
- `--output <path>`: Output file path - default: auto-generated
- `--width <width>`: Browser width - default: `1920`
- `--height <height>`: Browser height - default: `1080`
- `--wait <ms>`: Wait time after page load - default: `2000`
- `--headless <mode>`: Headless mode (`true`, `false`, `new`) - default: `true`
- `--selection <coords>`: Selection coordinates for selection mode (`x,y,width,height`)

### For AI Agents

This tool is specifically designed for use by AI agents:

```bash
# Simple usage
snapcoder capture https://example.com

# JSON output for parsing (future feature)
snapcoder capture https://example.com --format json

# Batch processing
snapcoder batch urls.txt --output-dir ./output
```

## Features

- ✅ Full page screenshots with optimized height detection (no white borders)
- ✅ Visible area screenshots  
- ✅ Selection area screenshots
- ✅ Batch processing
- ✅ Auto-generated filenames with timestamp
- ✅ Customizable browser viewport
- ✅ Headless and non-headless modes
- ✅ AI agent friendly CLI interface

## Technical Details

The CLI tool uses:
- **Puppeteer** for browser automation
- **Commander.js** for CLI interface
- **Chalk** for colored output
- Ported screenshot logic from the SnapCoder Chrome extension

## File Naming

Screenshots are automatically named as:
`snapcoder_{domain}_{YYYY-MM-DD_HH-MM-SS}.png`

For example: `snapcoder_example_2024-06-15_14-30-25.png`