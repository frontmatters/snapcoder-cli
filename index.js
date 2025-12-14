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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB in bytes

async function compressImageIfNeeded(buffer, filename) {
  const originalSize = buffer.length;

  if (originalSize <= MAX_FILE_SIZE) {
    console.log(chalk.gray(`📦 Image size OK: ${(originalSize / 1024 / 1024).toFixed(2)} MB`));
    return { buffer, filename };
  }

  console.log(chalk.yellow(`⚠️  Image too large: ${(originalSize / 1024 / 1024).toFixed(2)} MB, compressing...`));

  const metadata = await sharp(buffer).metadata();
  const totalPixels = metadata.width * metadata.height;
  const SHARP_PIXEL_LIMIT = 268402689; // Sharp's default pixel limit

  let workingBuffer = buffer;
  let newFilename = filename.replace('.png', '.jpg');

  // If image exceeds Sharp's pixel limit, resize first
  if (totalPixels > SHARP_PIXEL_LIMIT) {
    console.log(chalk.yellow(`⚠️  Image too large for processing (${metadata.width}x${metadata.height}), resizing first...`));
    const scale = Math.sqrt(SHARP_PIXEL_LIMIT / totalPixels) * 0.95; // 0.95 for safety margin
    const newWidth = Math.floor(metadata.width * scale);
    const newHeight = Math.floor(metadata.height * scale);

    workingBuffer = await sharp(buffer)
      .resize(newWidth, newHeight, { fit: 'inside' })
      .png()
      .toBuffer();

    console.log(chalk.gray(`📏 Resized to ${newWidth}x${newHeight} for processing`));
  }

  // Try JPEG compression (better compression than PNG for screenshots)
  console.log(chalk.gray(`🔄 Converting to JPEG for better compression...`));

  let quality = 90;
  let compressed = workingBuffer;

  while (quality > 20) {
    try {
      compressed = await sharp(workingBuffer)
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      const compressedSize = compressed.length;

      if (compressedSize <= MAX_FILE_SIZE) {
        console.log(chalk.green(`✅ Compressed to ${(compressedSize / 1024 / 1024).toFixed(2)} MB (JPEG quality: ${quality})`));
        return { buffer: compressed, filename: newFilename };
      }
    } catch (error) {
      console.log(chalk.red(`⚠️  Compression error at quality ${quality}: ${error.message}`));
      break;
    }

    quality -= 10;
  }

  // If still too large, resize further
  console.log(chalk.yellow(`⚠️  Still too large, resizing image...`));

  const currentMetadata = await sharp(workingBuffer).metadata();
  let scale = 0.9;

  while (scale > 0.3) {
    const newWidth = Math.floor(currentMetadata.width * scale);
    const newHeight = Math.floor(currentMetadata.height * scale);

    try {
      compressed = await sharp(workingBuffer)
        .resize(newWidth, newHeight, { fit: 'inside' })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();

      const compressedSize = compressed.length;

      if (compressedSize <= MAX_FILE_SIZE) {
        console.log(chalk.green(`✅ Resized to ${newWidth}x${newHeight} (${(compressedSize / 1024 / 1024).toFixed(2)} MB)`));
        return { buffer: compressed, filename: newFilename };
      }
    } catch (error) {
      console.log(chalk.red(`⚠️  Resize error at scale ${scale}: ${error.message}`));
      break;
    }

    scale -= 0.1;
  }

  console.log(chalk.red(`⚠️  Warning: Could not compress below 5 MB, using best effort`));
  return { buffer: compressed, filename: newFilename };
}

program
  .name('snapcoder')
  .description('CLI tool for creating website screenshots - AI agent friendly')
  .version('1.1.0', '-v, --version', 'Output the current version');

// Changelog command
program
  .command('changelog')
  .description('Show version history and changelog')
  .action(() => {
    console.log(chalk.blue('\n📋 SnapCoder Changelog\n'));

    console.log(chalk.green('v1.1.0') + chalk.gray(' - 2025-12-13'));
    console.log(chalk.yellow('  Added:'));
    console.log('    • Automatic image compression for size optimization (< 5 MB)');
    console.log('    • Corporate network support (proxy + SSL certificate errors)');
    console.log('    • File:// URL support for local HTML files');
    console.log('    • New --proxy option for manual proxy configuration');
    console.log('    • New --ignore-ssl option for corporate SSL interception');
    console.log('    • -v flag for version (in addition to --version)');
    console.log(chalk.yellow('  Fixed:'));
    console.log('    • OWASP security vulnerabilities (js-yaml, tar-fs)');
    console.log('    • Sharp pixel limit handling for very large screenshots');
    console.log(chalk.yellow('  Changed:'));
    console.log('    • Large screenshots (> 5 MB) automatically converted to JPEG');
    console.log('    • Added Sharp dependency for image processing');

    console.log(chalk.green('\nv1.0.0') + chalk.gray(' - Initial release'));
    console.log('    • Full page screenshots');
    console.log('    • Visible area screenshots');
    console.log('    • Selection area screenshots');
    console.log('    • Batch processing');

    console.log(chalk.gray('\nFor full details: https://github.com/frontmatters/snapcoder-cli\n'));
  });

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
  .option('--ignore-ssl', 'Ignore SSL certificate errors (useful for corporate networks)', false)
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
  .option('--proxy <url>', 'Proxy server URL (e.g., http://proxy.company.com:8080)')
  .option('--ignore-ssl', 'Ignore SSL certificate errors (useful for corporate networks)', false)
  .action(async (file, options) => {
    try {
      await batchCapture(file, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

async function captureScreenshot(url, options) {
  console.log(chalk.blue('🚀 Starting SnapCoder CLI...'));

  // Validate URL
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
    url = 'https://' + url;
  }
  
  console.log(chalk.gray(`📍 URL: ${url}`));
  console.log(chalk.gray(`📐 Mode: ${options.mode}`));
  console.log(chalk.gray(`🖥️  Browser: ${options.width}x${options.height}`));
  
  // Prepare browser args with corporate network support
  const browserArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process'
  ];

  // Add SSL ignoring flags if requested or if ignore-ssl option is set
  if (options.ignoreSsl) {
    browserArgs.push('--ignore-certificate-errors');
    browserArgs.push('--ignore-certificate-errors-spki-list');
    console.log(chalk.gray(`⚠️  SSL certificate errors will be ignored`));
  }

  // Support proxy from CLI option or environment variables
  const proxy = options.proxy || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
  if (proxy) {
    browserArgs.push(`--proxy-server=${proxy}`);
    console.log(chalk.gray(`🔌 Using proxy: ${proxy}`));
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
    const { buffer: finalScreenshot, filename: finalFilename } = await compressImageIfNeeded(screenshot, filename);

    await fs.writeFile(finalFilename, finalScreenshot);
    console.log(chalk.green(`✅ Screenshot saved: ${finalFilename}`));
    console.log(chalk.gray(`📊 Final file size: ${(finalScreenshot.length / 1024 / 1024).toFixed(2)} MB`));
    
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