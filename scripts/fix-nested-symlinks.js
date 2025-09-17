#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 清理嵌套的 @swyrlfi 符号链接
const packages = ['v2-sdk', 'v3-sdk', 'router-sdk', 'universal-router-sdk', 'uniswapx-sdk', 'permit2-sdk'];

packages.forEach(pkg => {
  const nestedPath = path.join(__dirname, '..', 'sdks', pkg, 'node_modules', '@swyrlfi');
  if (fs.existsSync(nestedPath)) {
    console.log(`Removing nested @swyrlfi from ${pkg}...`);
    fs.rmSync(nestedPath, { recursive: true, force: true });
  }
});

console.log('✅ Nested symlinks cleaned');