#!/usr/bin/env node

import { program } from 'commander';
import puppeteer from 'puppeteer';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Maximum file size for Claude Code compatibility (5 MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_PIXELS = 268000000; // Sharp's pixel limit
const MAX_DIMENSION = 8000; // Claude API maximum dimension (width or height)

program
  .name('snapcoder')
  .description('CLI tool for creating website screenshots - AI agent friendly')
  .version('1.2.2', '-v, --version', 'Output the current version');

program
  .command('capture')
  .description('Take a screenshot of a website')
  .argument('<url>', 'Website URL')
  .option('-o, --output <path>', 'Output file path (default: auto-generated)')
  .option('-m, --mode <mode>', 'Screenshot mode: visible, fullpage, or selection', 'fullpage')
  .option('-w, --width <width>', 'Browser width', '1920')
  .option('-h, --height <height>', 'Browser height', '1080')
  .option('--wait <ms>', 'Wait time in milliseconds after page load', '2000')
  .option('--headless <mode>', 'Headless mode: true, false, or new', 'true')
  .option('--selection <coords>', 'Selection coordinates for selection mode (x,y,width,height)')
  .option('--proxy <url>', 'Proxy server URL (e.g., http://proxy.company.com:8080)')
  .option('--ignore-ssl', 'Ignore SSL certificate errors (useful for corporate networks)')
  .action(async (url, options) => {
    try {
      await captureScreenshot(url, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('Take screenshots of multiple websites from a file')
  .argument('<file>', 'File with URLs (one per line)')
  .option('-o, --output-dir <dir>', 'Output directory', './snapcoder')
  .option('-m, --mode <mode>', 'Screenshot mode', 'fullpage')
  .option('-w, --width <width>', 'Browser width', '1920')
  .option('-h, --height <height>', 'Browser height', '1080')
  .option('--wait <ms>', 'Wait time per page', '2000')
  .option('--proxy <url>', 'Proxy server URL')
  .option('--ignore-ssl', 'Ignore SSL certificate errors')
  .action(async (file, options) => {
    try {
      await batchCapture(file, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('changelog')
  .description('Show version history and changelog')
  .action(() => {
    console.log(chalk.blue('\n📋 SnapCoder Changelog\n'));

    console.log(chalk.bold('Version 1.2.2') + chalk.gray(' (2025-12-25)'));
    console.log(chalk.green('  Added:'));
    console.log('    • Automatic dimension checking (max 8000px per dimension for Claude API)');
    console.log('    • Smart resizing for images exceeding dimension limits');
    console.log(chalk.yellow('  Fixed:'));
    console.log('    • Images now automatically resized to meet Claude API dimension requirements');
    console.log('    • Better handling of very large screenshots\n');

    console.log(chalk.bold('Version 1.2.0') + chalk.gray(' (2025-12-14)'));
    console.log(chalk.green('  Added:'));
    console.log('    • Automatic image compression for Claude Code compatibility (< 5 MB)');
    console.log('    • Corporate network support (proxy + SSL certificate handling)');
    console.log('    • File:// URL support for local HTML files');
    console.log('    • Changelog command (snapcoder changelog)');
    console.log('    • -v flag for version display');
    console.log(chalk.yellow('  Fixed:'));
    console.log('    • OWASP security vulnerabilities (js-yaml, tar-fs)');
    console.log('    • Sharp pixel limit handling for very large screenshots');
    console.log(chalk.blue('  Changed:'));
    console.log('    • Large screenshots (> 5 MB) automatically converted to JPEG');
    console.log('    • Package renamed from @frontmatters/snapcoder-cli to snapcoder\n');

    console.log(chalk.bold('Version 1.1.1') + chalk.gray(' (2024)'));
    console.log(chalk.green('  Added:'));
    console.log('    • Optimized full-page screenshot capture');
    console.log('    • Better lazy-loading content handling\n');

    console.log(chalk.bold('Version 1.0.0') + chalk.gray(' (2024)'));
    console.log(chalk.green('  Added:'));
    console.log('    • Initial release');
    console.log('    • Full-page, visible area, and selection screenshot modes');
    console.log('    • Batch processing support');
    console.log('    • AI agent friendly CLI interface\n');
  });

async function compressImageIfNeeded(buffer, filename) {
  const originalSize = buffer.length;

  // Check image dimensions first
  const image = sharp(buffer);
  const metadata = await image.metadata();

  const exceedsSize = originalSize > MAX_FILE_SIZE;
  const exceedsDimensions = metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION;

  // If image meets all requirements, return as-is
  if (!exceedsSize && !exceedsDimensions) {
    console.log(chalk.gray(`📦 Image OK: ${(originalSize / 1024 / 1024).toFixed(2)} MB, ${metadata.width}x${metadata.height}px`));
    return { buffer, filename };
  }

  if (exceedsSize) {
    console.log(chalk.yellow(`⚠️  Image too large: ${(originalSize / 1024 / 1024).toFixed(2)} MB`));
  }
  if (exceedsDimensions) {
    console.log(chalk.yellow(`⚠️  Image dimensions too large: ${metadata.width}x${metadata.height}px (max: ${MAX_DIMENSION}px per dimension)`));
  }
  console.log(chalk.blue('🔄 Processing image...'));

  try {
    const totalPixels = metadata.width * metadata.height;

    // Calculate required scaling
    let scale = 1;
    let resizeReason = '';

    // Check dimension limits (Claude API: 8000px max per dimension)
    if (exceedsDimensions) {
      const widthScale = metadata.width > MAX_DIMENSION ? MAX_DIMENSION / metadata.width : 1;
      const heightScale = metadata.height > MAX_DIMENSION ? MAX_DIMENSION / metadata.height : 1;
      scale = Math.min(widthScale, heightScale) * 0.95; // 5% safety margin
      resizeReason = 'dimension limit';
    }

    // Check if image exceeds Sharp's pixel limit
    if (totalPixels > MAX_PIXELS) {
      const pixelScale = Math.sqrt(MAX_PIXELS / totalPixels) * 0.95; // 5% safety margin
      scale = Math.min(scale === 1 ? pixelScale : scale, pixelScale);
      resizeReason = resizeReason ? 'dimension and pixel limits' : 'pixel limit';
    }

    // Resize if needed
    let processedBuffer = buffer;
    let currentWidth = metadata.width;
    let currentHeight = metadata.height;

    if (scale < 1) {
      const newWidth = Math.floor(metadata.width * scale);
      const newHeight = Math.floor(metadata.height * scale);

      console.log(chalk.blue(`🔄 Resizing due to ${resizeReason}...`));
      console.log(chalk.gray(`   Resizing from ${metadata.width}x${metadata.height} to ${newWidth}x${newHeight}`));

      // Resize first
      processedBuffer = await sharp(buffer)
        .resize(newWidth, newHeight, { fit: 'inside' })
        .png()
        .toBuffer();

      currentWidth = newWidth;
      currentHeight = newHeight;
    }

    // Now check if we need to compress for file size
    const resizedSize = processedBuffer.length;

    // If after resizing we're still over the file size limit, compress to JPEG
    if (resizedSize > MAX_FILE_SIZE) {
      console.log(chalk.blue('🔄 Converting to JPEG for better compression...'));

      let quality = 90;
      let compressed = await sharp(processedBuffer)
        .jpeg({ quality, progressive: true })
        .toBuffer();

      // Keep reducing quality until we're under 5 MB or hit minimum quality
      while (compressed.length > MAX_FILE_SIZE && quality > 20) {
        quality -= 10;
        console.log(chalk.gray(`   Trying quality ${quality}%...`));
        compressed = await sharp(processedBuffer)
          .jpeg({ quality, progressive: true })
          .toBuffer();
      }

      // If still too large, try further resizing
      if (compressed.length > MAX_FILE_SIZE) {
        console.log(chalk.yellow('   Still too large, resizing further...'));
        let additionalScale = 0.9;

        while (compressed.length > MAX_FILE_SIZE && additionalScale > 0.3) {
          const newWidth = Math.floor(currentWidth * additionalScale);
          const newHeight = Math.floor(currentHeight * additionalScale);

          console.log(chalk.gray(`   Trying ${newWidth}x${newHeight} (${Math.round(additionalScale * 100)}%)...`));

          compressed = await sharp(processedBuffer)
            .resize(newWidth, newHeight, { fit: 'inside' })
            .jpeg({ quality: 80, progressive: true })
            .toBuffer();

          additionalScale -= 0.1;
        }
      }

      const newSize = compressed.length;
      const compression = ((1 - newSize / originalSize) * 100).toFixed(1);

      if (newSize > MAX_FILE_SIZE) {
        console.log(chalk.yellow(`⚠️  Best effort: ${(newSize / 1024 / 1024).toFixed(2)} MB (${compression}% reduction)`));
        console.log(chalk.gray('   Image still exceeds 5 MB limit - consider using selection mode'));
      } else {
        console.log(chalk.green(`✅ Processed: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ${(newSize / 1024 / 1024).toFixed(2)} MB (${compression}% reduction)`));
      }

      // Change extension to .jpg
      const newFilename = filename.replace(/\.png$/i, '.jpg');
      return { buffer: compressed, filename: newFilename };
    }

    // If we resized but don't need JPEG compression, return the resized PNG
    if (scale < 1) {
      const finalSize = processedBuffer.length;
      console.log(chalk.green(`✅ Resized: ${metadata.width}x${metadata.height} → ${currentWidth}x${currentHeight} (${(finalSize / 1024 / 1024).toFixed(2)} MB)`));
      return { buffer: processedBuffer, filename };
    }

    // Should never reach here, but just in case
    return { buffer: processedBuffer, filename };

  } catch (error) {
    console.error(chalk.red('Compression failed:'), error.message);
    console.log(chalk.yellow('Saving original PNG...'));
    return { buffer, filename };
  }
}

async function captureScreenshot(url, options) {
  console.log(chalk.blue('🚀 Starting SnapCoder CLI...'));

  // Validate and normalize URL
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
    url = 'https://' + url;
  }

  console.log(chalk.gray(`📍 URL: ${url}`));
  console.log(chalk.gray(`📐 Mode: ${options.mode}`));
  console.log(chalk.gray(`🖥️  Browser: ${options.width}x${options.height}`));

  // Detect proxy from environment or options
  const proxy = options.proxy ||
                process.env.HTTPS_PROXY ||
                process.env.HTTP_PROXY ||
                process.env.https_proxy ||
                process.env.http_proxy;

  if (proxy) {
    console.log(chalk.gray(`🔌 Proxy: ${proxy}`));
  }

  if (options.ignoreSsl) {
    console.log(chalk.gray('🔓 SSL verification: disabled'));
  }

  // Build browser args with corporate network support
  const browserArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process'
  ];

  if (options.ignoreSsl) {
    browserArgs.push('--ignore-certificate-errors');
    browserArgs.push('--ignore-certificate-errors-spki-list');
  }

  if (proxy) {
    browserArgs.push(`--proxy-server=${proxy}`);
  }

  const browser = await puppeteer.launch({
    headless: options.headless === 'true' ? true : options.headless === 'false' ? false : 'new',
    args: browserArgs,
    defaultViewport: null,
    ignoreHTTPSErrors: options.ignoreSsl || false
  });

  try {
    const page = await browser.newPage();

    // Set user agent to match Chrome extension environment
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    // Set viewport to match Chrome extension
    await page.setViewport({
      width: parseInt(options.width),
      height: parseInt(options.height),
      deviceScaleFactor: 1
    });

    console.log(chalk.yellow('⏳ Loading page...'));
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait extra time as specified
    if (parseInt(options.wait) > 0) {
      console.log(chalk.yellow(`⏳ Waiting ${options.wait}ms...`));
      await new Promise(resolve => setTimeout(resolve, parseInt(options.wait)));
    }

    let screenshot;
    let filename = options.output;

    if (!filename) {
      // Ensure snapcoder directory exists
      const snapcoderDir = path.join(process.cwd(), 'snapcoder');
      await fs.mkdir(snapcoderDir, { recursive: true });

      const domain = new URL(url).hostname.replace('www.', '').split('.')[0] || 'screenshot';
      const timestamp = new Date().toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .split('.')[0];
      filename = path.join(snapcoderDir, `snapcoder_${domain}_${timestamp}.png`);
    }

    switch (options.mode) {
      case 'visible':
        console.log(chalk.yellow('📸 Taking visible area screenshot...'));
        screenshot = await page.screenshot({
          type: 'png',
          quality: 100
        });
        break;

      case 'fullpage':
        console.log(chalk.yellow('📸 Taking full page screenshot...'));
        screenshot = await captureFullPageOptimized(page);
        break;

      case 'selection':
        if (!options.selection) {
          throw new Error('Selection coordinates required for selection mode (--selection x,y,width,height)');
        }
        const [x, y, width, height] = options.selection.split(',').map(n => parseInt(n));
        console.log(chalk.yellow(`📸 Taking selection screenshot (${x},${y} ${width}x${height})...`));
        screenshot = await page.screenshot({
          type: 'png',
          clip: { x, y, width, height }
        });
        break;

      default:
        throw new Error(`Unknown mode: ${options.mode}`);
    }

    // Compress if needed
    const result = await compressImageIfNeeded(screenshot, filename);

    await fs.writeFile(result.filename, result.buffer);
    console.log(chalk.green(`✅ Screenshot saved: ${result.filename}`));
    console.log(chalk.gray(`📊 File size: ${(result.buffer.length / 1024).toFixed(1)} KB`));

  } finally {
    await browser.close();
  }
}

async function captureFullPageOptimized(page) {
  // Port of SnapCoder's optimized full page logic
  console.log(chalk.gray('🔍 Determining page dimensions...'));

  // First scroll down to load lazy-loaded content
  await page.evaluate(() => {
    return new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if(totalHeight >= scrollHeight){
          clearInterval(timer);
          window.scrollTo(0, 0); // Scroll back to top
          resolve();
        }
      }, 100);
    });
  });

  // Wait a moment for all content to be loaded
  await new Promise(resolve => setTimeout(resolve, 1000));

  const dimensions = await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;

    const width = Math.max(
      Math.max(body.scrollWidth, body.offsetWidth),
      Math.max(html.clientWidth, html.scrollWidth, html.offsetWidth)
    );

    // Get the maximum height from all sources
    let height = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    );

    // Don't try to optimize/reduce height - use the full document height
    // This ensures we capture everything including the footer

    return { width, height };
  });

  console.log(chalk.gray(`📏 Page dimensions: ${dimensions.width}x${dimensions.height}px`));

  // Take the full page screenshot using Puppeteer's built-in method
  return await page.screenshot({
    type: 'png',
    fullPage: true
  });
}

async function batchCapture(file, options) {
  console.log(chalk.blue('🚀 Starting batch capture...'));

  const urls = (await fs.readFile(file, 'utf-8'))
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  console.log(chalk.gray(`📋 Found ${urls.length} URLs`));

  // Ensure output directory exists
  await fs.mkdir(options.outputDir, { recursive: true });

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(chalk.blue(`\n[${i + 1}/${urls.length}] ${url}`));

    try {
      const domain = new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace('www.', '').split('.')[0];
      const timestamp = new Date().toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .split('.')[0];
      const filename = path.join(options.outputDir, `snapcoder_${domain}_${timestamp}.png`);

      await captureScreenshot(url, { ...options, output: filename });

    } catch (error) {
      console.error(chalk.red(`❌ Error with ${url}:`), error.message);
    }
  }

  console.log(chalk.green(`\n✅ Batch capture completed! Screenshots saved to: ${options.outputDir}`));
}

program.parse();
