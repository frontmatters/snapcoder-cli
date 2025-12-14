# SnapCoder

Command-line interface for taking website screenshots - AI agent friendly version of SnapCoder Chrome extension.

## Installation

```bash
# Global installation (recommended)
npm install -g snapcoder

# Or locally in your project
npm install snapcoder
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
- `--proxy <url>`: Proxy server URL (e.g., `http://proxy.company.com:8080`)
- `--ignore-ssl`: Ignore SSL certificate errors (useful for corporate networks)

### Corporate Network Support

SnapCoder works seamlessly in corporate environments:

```bash
# Automatic proxy detection via environment variables
export HTTPS_PROXY=http://proxy.company.com:8080
snapcoder capture https://example.com

# Manual proxy configuration
snapcoder capture https://example.com --proxy http://proxy:8080

# Ignore SSL certificate errors (for corporate SSL interception)
snapcoder capture https://example.com --ignore-ssl

# Combined usage
snapcoder capture https://example.com --proxy http://proxy:8080 --ignore-ssl
```

Supports standard proxy environment variables:
- `HTTPS_PROXY` / `https_proxy`
- `HTTP_PROXY` / `http_proxy`

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
- ✅ **Automatic image compression** (keeps screenshots under 5 MB)
- ✅ **Corporate network support** (proxy + SSL certificate handling)
- ✅ **File:// URL support** for local HTML files

## Technical Details

The CLI tool uses:
- **Puppeteer** for browser automation
- **Commander.js** for CLI interface
- **Chalk** for colored output
- **Sharp** for image compression and optimization
- Ported screenshot logic from the SnapCoder Chrome extension

### Image Compression

Screenshots larger than 5 MB are automatically compressed:
1. Converts PNG to JPEG for better compression
2. Progressive quality reduction (90% → 20%) until < 5 MB
3. Automatic resize if needed (maintains aspect ratio)
4. Handles very large images (pixel limit safe)

Example: 119 MB PNG → 3.3 MB JPEG (97% size reduction)

## File Naming

Screenshots are automatically named as:
`snapcoder_{domain}_{YYYY-MM-DD_HH-MM-SS}.png`

For example: `snapcoder_example_2024-06-15_14-30-25.png`

**Note**: Large screenshots are automatically converted to `.jpg` for compression.

## Changelog

### [1.1.0] - 2025-12-13

#### Added
- Automatic image compression for size optimization (< 5 MB)
- Corporate network support (proxy + SSL certificate errors)
- File:// URL support for local HTML files
- New `--proxy` option for manual proxy configuration
- New `--ignore-ssl` option for corporate SSL interception

#### Fixed
- OWASP security vulnerabilities (js-yaml, tar-fs)
- Sharp pixel limit handling for very large screenshots

#### Changed
- Large screenshots (> 5 MB) are automatically converted to JPEG
- Added Sharp dependency for image processing

### [1.0.0] - Initial release
- Full page screenshots
- Visible area screenshots
- Selection area screenshots
- Batch processing