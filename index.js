#!/usr/bin/env node

import { program } from 'commander';
import puppeteer from 'puppeteer';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

program
  .name('snapcoder')
  .description('CLI tool for creating website screenshots - AI agent friendly')
  .version('1.0.0');

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
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  console.log(chalk.gray(`📍 URL: ${url}`));
  console.log(chalk.gray(`📐 Mode: ${options.mode}`));
  console.log(chalk.gray(`🖥️  Browser: ${options.width}x${options.height}`));
  
  const browser = await puppeteer.launch({
    headless: options.headless === 'true' ? true : options.headless === 'false' ? false : 'new',
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process'
    ],
    defaultViewport: null
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
    
    await fs.writeFile(filename, screenshot);
    console.log(chalk.green(`✅ Screenshot saved: ${filename}`));
    console.log(chalk.gray(`📊 File size: ${(screenshot.length / 1024).toFixed(1)} KB`));
    
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