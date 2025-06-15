# SnapCoder CLI

Command-line interface voor het maken van website screenshots - AI agent vriendelijke versie van de SnapCoder Chrome extension.

## Installatie

```bash
# Globale installatie (aanbevolen)
npm install -g @frontmatters/snapcoder-cli

# Of lokaal in je project
npm install @frontmatters/snapcoder-cli
```

## Gebruik

### Enkele screenshot maken

Screenshots worden standaard opgeslagen in de `./snapcoder/` subdirectory in je huidige werkdirectory.

```bash
# Full page screenshot (opgeslagen in ./snapcoder/)
snapcoder capture https://example.com

# Visible area screenshot
snapcoder capture https://example.com --mode visible

# Custom output pad
snapcoder capture https://example.com --output my-screenshot.png

# Custom browser size
snapcoder capture https://example.com --width 1280 --height 720

# Selection area screenshot
snapcoder capture https://example.com --mode selection --selection "100,100,800,600"
```

### Batch screenshots

```bash
# Maak urls.txt met één URL per regel
echo "https://example.com" > urls.txt
echo "https://google.com" >> urls.txt

# Run batch capture (standaard naar ./snapcoder/)
snapcoder batch urls.txt

# Of met custom directory
snapcoder batch urls.txt --output-dir ./my-screenshots
```

### Opties

- `--mode <mode>`: Screenshot modus (`visible`, `fullpage`, `selection`) - default: `fullpage`
- `--output <path>`: Output bestandspad - default: auto-generated
- `--width <width>`: Browser breedte - default: `1920`
- `--height <height>`: Browser hoogte - default: `1080`
- `--wait <ms>`: Wacht tijd na laden pagina - default: `2000`
- `--headless <mode>`: Headless modus (`true`, `false`, `new`) - default: `true`
- `--selection <coords>`: Selectie coördinaten voor selection mode (`x,y,width,height`)

### Voor AI Agents

Deze tool is specifiek ontworpen voor gebruik door AI agents:

```bash
# Simpel gebruik
snapcoder capture https://example.com

# JSON output voor parsing (future feature)
snapcoder capture https://example.com --format json

# Batch processing
snapcoder batch urls.txt --output-dir ./output
```

## Features

- ✅ Full page screenshots met optimized height detection (geen witte rand)
- ✅ Visible area screenshots  
- ✅ Selection area screenshots
- ✅ Batch processing
- ✅ Auto-generated filenames met timestamp
- ✅ Customizable browser viewport
- ✅ Headless en non-headless modes
- ✅ AI agent vriendelijke CLI interface

## Technische Details

De CLI tool gebruikt:
- **Puppeteer** voor browser automation
- **Commander.js** voor CLI interface
- **Chalk** voor colored output
- Geporteerde screenshot logica van de SnapCoder Chrome extension

## Bestandsnaming

Screenshots worden automatisch benoemd als:
`snapcoder_{domain}_{YYYY-MM-DD_HH-MM-SS}.png`

Bijvoorbeeld: `snapcoder_example_2024-06-15_14-30-25.png`