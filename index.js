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
  .description('CLI tool voor het maken van website screenshots - AI agent vriendelijk')
  .version('1.0.0');

program
  .command('capture')
  .description('Maak een screenshot van een website')
  .argument('<url>', 'URL van de website')
  .option('-o, --output <path>', 'Output bestandspad (default: auto-generated)')
  .option('-m, --mode <mode>', 'Screenshot modus: visible, fullpage, of selection', 'fullpage')
  .option('-w, --width <width>', 'Browser breedte', '1920')
  .option('-h, --height <height>', 'Browser hoogte', '1080')
  .option('--wait <ms>', 'Wacht tijd in milliseconden na laden pagina', '2000')
  .option('--headless <mode>', 'Headless modus: true, false, of new', 'true')
  .option('--selection <coords>', 'Selectie coördinaten voor selection mode (x,y,width,height)')
  .action(async (url, options) => {
    try {
      await captureScreenshot(url, options);
    } catch (error) {
      console.error(chalk.red('Fout:'), error.message);
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('Maak screenshots van meerdere websites uit een bestand')
  .argument('<file>', 'Bestand met URLs (één per regel)')
  .option('-o, --output-dir <dir>', 'Output directory', './snapcoder')
  .option('-m, --mode <mode>', 'Screenshot modus', 'fullpage')
  .option('-w, --width <width>', 'Browser breedte', '1920')
  .option('-h, --height <height>', 'Browser hoogte', '1080')
  .option('--wait <ms>', 'Wacht tijd per pagina', '2000')
  .action(async (file, options) => {
    try {
      await batchCapture(file, options);
    } catch (error) {
      console.error(chalk.red('Fout:'), error.message);
      process.exit(1);
    }
  });

async function captureScreenshot(url, options) {
  console.log(chalk.blue('🚀 Start SnapCoder CLI...'));
  
  // Valideer URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  console.log(chalk.gray(`📍 URL: ${url}`));
  console.log(chalk.gray(`📐 Modus: ${options.mode}`));
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
    
    console.log(chalk.yellow('⏳ Laden pagina...'));
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wacht extra tijd zoals gespecificeerd
    if (parseInt(options.wait) > 0) {
      console.log(chalk.yellow(`⏳ Wacht ${options.wait}ms...`));
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
        console.log(chalk.yellow('📸 Maak visible area screenshot...'));
        screenshot = await page.screenshot({ 
          type: 'png',
          quality: 100
        });
        break;
        
      case 'fullpage':
        console.log(chalk.yellow('📸 Maak full page screenshot...'));
        screenshot = await captureFullPageOptimized(page);
        break;
        
      case 'selection':
        if (!options.selection) {
          throw new Error('Selection coördinaten vereist voor selection mode (--selection x,y,width,height)');
        }
        const [x, y, width, height] = options.selection.split(',').map(n => parseInt(n));
        console.log(chalk.yellow(`📸 Maak selection screenshot (${x},${y} ${width}x${height})...`));
        screenshot = await page.screenshot({
          type: 'png',
          clip: { x, y, width, height }
        });
        break;
        
      default:
        throw new Error(`Onbekende modus: ${options.mode}`);
    }
    
    await fs.writeFile(filename, screenshot);
    console.log(chalk.green(`✅ Screenshot opgeslagen: ${filename}`));
    console.log(chalk.gray(`📊 Bestandsgrootte: ${(screenshot.length / 1024).toFixed(1)} KB`));
    
  } finally {
    await browser.close();
  }
}

async function captureFullPageOptimized(page) {
  // Port van SnapCoder's optimized full page logic
  console.log(chalk.gray('🔍 Bepaal pagina afmetingen...'));
  
  // Scroll eerst naar beneden om lazy-loaded content te laden
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
          window.scrollTo(0, 0); // Scroll terug naar boven
          resolve();
        }
      }, 100);
    });
  });
  
  // Wacht even voor alle content geladen is
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
  
  console.log(chalk.gray(`📏 Pagina afmetingen: ${dimensions.width}x${dimensions.height}px`));
  
  // Take the full page screenshot using Puppeteer's built-in method
  return await page.screenshot({
    type: 'png',
    fullPage: true
  });
}

async function batchCapture(file, options) {
  console.log(chalk.blue('🚀 Start batch capture...'));
  
  const urls = (await fs.readFile(file, 'utf-8'))
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  
  console.log(chalk.gray(`📋 Gevonden ${urls.length} URLs`));
  
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
      console.error(chalk.red(`❌ Fout bij ${url}:`), error.message);
    }
  }
  
  console.log(chalk.green(`\n✅ Batch capture voltooid! Screenshots opgeslagen in: ${options.outputDir}`));
}

program.parse();