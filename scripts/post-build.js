#!/usr/bin/env node
/**
 * Post-build script for standalone Next.js build
 * Copies static assets (provider logos, etc.) to standalone output
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = process.cwd();
const standaloneDir = path.join(projectRoot, '.next/standalone');
const publicDir = path.join(projectRoot, 'public');
const standalonePublicDir = path.join(standaloneDir, 'public');
const providersSourceDir = path.join(publicDir, 'providers');
const providersTargetDir = path.join(standalonePublicDir, 'providers');

console.log('[post-build] Preparing standalone build...\n');

// 1. Create symlink for static assets
console.log('[post-build] Linking .next/static...');
try {
  const staticLink = path.join(standaloneDir, '.next', 'static');
  const staticTarget = path.join(projectRoot, '.next', 'static');
  
  // Remove existing symlink if present
  if (fs.existsSync(staticLink) && fs.lstatSync(staticLink).isSymbolicLink()) {
    fs.unlinkSync(staticLink);
  }
  
  // Create symlink pointing to .next/static
  if (fs.existsSync(staticTarget)) {
    fs.symlinkSync(path.relative(path.dirname(staticLink), staticTarget), staticLink, 'dir');
    console.log('✅ .next/static linked\n');
  } else {
    console.log('⚠️  .next/static not found, skipping symlink\n');
  }
} catch (e) {
  console.warn(`⚠️  .next/static symlink failed: ${e.message}\n`);
}

// 2. Copy entire public folder
console.log('[post-build] Copying public folder...');
try {
  if (!fs.existsSync(standalonePublicDir)) {
    fs.mkdirSync(standalonePublicDir, { recursive: true });
  }
  
  // Copy all files and folders from public to standalone/public
  const copyDir = (src, dst) => {
    if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
    
    for (const file of fs.readdirSync(src)) {
      const srcPath = path.join(src, file);
      const dstPath = path.join(dst, file);
      
      if (fs.statSync(srcPath).isDirectory()) {
        copyDir(srcPath, dstPath);
      } else {
        fs.copyFileSync(srcPath, dstPath);
      }
    }
  };
  
  copyDir(publicDir, standalonePublicDir);
  console.log('✅ Public folder copied\n');
} catch (e) {
  console.error(`❌ Failed to copy public folder: ${e.message}`);
  process.exit(1);
}

// 3. Verify provider logos
console.log('[post-build] Verifying provider logos...');
try {
  const logoCount = fs.readdirSync(providersTargetDir).length;
  console.log(`✅ ${logoCount} provider logos available\n`);
} catch (e) {
  console.warn(`⚠️  Provider logos folder not found: ${e.message}\n`);
}

console.log('[post-build] ✅ Build complete - standalone ready for deployment');
