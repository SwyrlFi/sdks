#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get all package directories
const packages = [
  'sdk-core',
  'v2-sdk',
  'v3-sdk',
  'router-sdk',
  'universal-router-sdk',
  'uniswapx-sdk',
  'permit2-sdk',
  'smart-order-router'
];

// Update each package.json to restore workspace:*
packages.forEach(pkg => {
  const pkgPath = path.join(__dirname, '..', 'sdks', pkg, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  let modified = false;

  // Update dependencies
  if (pkgJson.dependencies) {
    Object.keys(pkgJson.dependencies).forEach(dep => {
      if (dep.startsWith('@swyrlfi/')) {
        pkgJson.dependencies[dep] = 'workspace:*';
        modified = true;
      }
    });
  }

  // Update devDependencies
  if (pkgJson.devDependencies) {
    Object.keys(pkgJson.devDependencies).forEach(dep => {
      if (dep.startsWith('@swyrlfi/')) {
        pkgJson.devDependencies[dep] = 'workspace:*';
        modified = true;
      }
    });
  }

  // Write back if modified
  if (modified) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2) + '\n');
    console.log(`✅ Restored workspace:* in ${pkg}/package.json`);
  }
});

console.log('\n✅ All packages restored to workspace:* protocol');