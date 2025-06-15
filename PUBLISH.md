# NPM Publicatie Instructies voor snapcoder-cli

## Voorbereiding

1. **NPM Account**: Zorg dat je een NPM account hebt op https://www.npmjs.com/

2. **Login op NPM**:
   ```bash
   npm login
   ```

3. **Update de package.json**:
   - Vervang `yourusername` in de repository URLs met je GitHub username
   - Overweeg een unieke package naam als `snapcoder-cli` al bezet is

## Publiceren

### Eerste keer publiceren:
```bash
cd /Users/mistermeneer/CascadeProjects/snapcoder-cli
npm publish
```

### Updates publiceren:
```bash
# Versie verhogen (kies één):
npm version patch  # Voor bug fixes (1.0.0 -> 1.0.1)
npm version minor  # Voor nieuwe features (1.0.0 -> 1.1.0)
npm version major  # Voor breaking changes (1.0.0 -> 2.0.0)

# Publiceer de nieuwe versie
npm publish
```

## Na publicatie

Gebruikers kunnen dan installeren met:
```bash
# Globale installatie (aanbevolen)
npm install -g snapcoder-cli

# Gebruik
snapcoder capture https://example.com
```

## Checklist voor publicatie

- [ ] Test de CLI lokaal
- [ ] Controleer of alle dependencies correct zijn
- [ ] Update README met installatie instructies
- [ ] Vervang placeholder GitHub URLs in package.json
- [ ] Kies een unieke package naam indien nodig
- [ ] Test met `npm pack` voor een dry-run

## Tips

- Gebruik `npm pack` om te zien wat er gepubliceerd wordt
- Check beschikbaarheid naam: `npm view snapcoder-cli`
- Overweeg een scoped package: `@yourusername/snapcoder-cli`