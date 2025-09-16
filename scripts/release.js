#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function getPackages() {
  const sdksPath = path.join(__dirname, '..', 'sdks');
  const packages = fs.readdirSync(sdksPath)
    .filter(dir => {
      const pkgPath = path.join(sdksPath, dir, 'package.json');
      return fs.existsSync(pkgPath) && dir !== 'uniswapx-sdk'; // exclude integration folder
    })
    .map(dir => {
      const pkgPath = path.join(sdksPath, dir, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return {
        name: pkg.name,
        version: pkg.version,
        path: path.join(sdksPath, dir)
      };
    });

  // Add uniswapx-sdk separately (it's in the list but we want to handle it specially)
  const uniswapxPath = path.join(sdksPath, 'uniswapx-sdk', 'package.json');
  if (fs.existsSync(uniswapxPath)) {
    const pkg = JSON.parse(fs.readFileSync(uniswapxPath, 'utf8'));
    packages.push({
      name: pkg.name,
      version: pkg.version,
      path: path.join(sdksPath, 'uniswapx-sdk')
    });
  }

  return packages;
}

async function selectPackages(packages) {
  console.log('\n📦 Available packages:');
  packages.forEach((pkg, index) => {
    console.log(`  ${index + 1}. ${pkg.name} (current: ${pkg.version})`);
  });
  console.log(`  ${packages.length + 1}. All packages`);

  const answer = await question('\nSelect packages to publish (comma-separated numbers): ');
  const indices = answer.split(',').map(n => parseInt(n.trim()) - 1);

  if (indices.includes(packages.length)) {
    return packages;
  }

  return indices.map(i => packages[i]).filter(Boolean);
}

async function selectReleaseType() {
  console.log('\n🚀 Release type:');
  console.log('  1. Alpha (testing version)');
  console.log('  2. Beta (preview version)');
  console.log('  3. RC (release candidate)');
  console.log('  4. Release (production version)');

  const answer = await question('\nSelect release type (1-4): ');
  const types = ['alpha', 'beta', 'rc', 'latest'];
  return types[parseInt(answer) - 1] || 'latest';
}

async function selectVersionBump() {
  console.log('\n📈 Version bump:');
  console.log('  1. Patch (0.0.x)');
  console.log('  2. Minor (0.x.0)');
  console.log('  3. Major (x.0.0)');
  console.log('  4. Custom version');

  const answer = await question('\nSelect version bump (1-4): ');

  if (answer === '4') {
    return await question('Enter custom version: ');
  }

  const bumps = ['patch', 'minor', 'major'];
  return bumps[parseInt(answer) - 1] || 'patch';
}

async function publishPackage(pkg, releaseType, versionBump) {
  console.log(`\n📦 Publishing ${pkg.name}...`);

  try {
    // Change to package directory
    process.chdir(pkg.path);

    // Determine version command
    let versionCmd;
    if (releaseType !== 'latest') {
      // For prerelease versions
      if (versionBump === 'patch' || versionBump === 'minor' || versionBump === 'major') {
        versionCmd = `npm version pre${versionBump} --preid=${releaseType}`;
      } else {
        versionCmd = `npm version ${versionBump}`;
      }
    } else {
      // For release versions
      versionCmd = `npm version ${versionBump}`;
    }

    // Update version
    console.log(`  Running: ${versionCmd}`);
    execSync(versionCmd, { stdio: 'inherit' });

    // Build package
    console.log('  Building package...');
    execSync('yarn build', { stdio: 'inherit' });

    // Publish to npm
    const publishCmd = releaseType === 'latest'
      ? 'npm publish --access public'
      : `npm publish --tag ${releaseType} --access public`;

    console.log(`  Running: ${publishCmd}`);
    execSync(publishCmd, { stdio: 'inherit' });

    console.log(`✅ Successfully published ${pkg.name}`);
  } catch (error) {
    console.error(`❌ Failed to publish ${pkg.name}: ${error.message}`);
  }
}

async function main() {
  console.log('🎯 Manual Package Publisher\n');

  try {
    // Get all packages
    const packages = await getPackages();

    // Select packages to publish
    const selectedPackages = await selectPackages(packages);

    if (selectedPackages.length === 0) {
      console.log('No packages selected.');
      process.exit(0);
    }

    // Select release type
    const releaseType = await selectReleaseType();

    // Select version bump
    const versionBump = await selectVersionBump();

    // Confirmation
    console.log('\n📋 Summary:');
    console.log(`  Packages: ${selectedPackages.map(p => p.name).join(', ')}`);
    console.log(`  Release type: ${releaseType}`);
    console.log(`  Version bump: ${versionBump}`);

    const confirm = await question('\nProceed with publishing? (y/n): ');

    if (confirm.toLowerCase() !== 'y') {
      console.log('Publishing cancelled.');
      process.exit(0);
    }

    // Publish each package
    for (const pkg of selectedPackages) {
      await publishPackage(pkg, releaseType, versionBump);
    }

    console.log('\n✅ Publishing complete!');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();