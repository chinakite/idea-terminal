#!/usr/bin/env node
/**
 * Generates icon files from build/icon.svg:
 *   build/icon.png   — 1024×1024 PNG (all platforms)
 *   build/icon.icns  — macOS (via sips + iconutil)
 *
 * Run: npm run make-icon
 * Requires: macOS (for .icns generation)
 */
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { execSync } from 'child_process'
import { platform } from 'os'

const root = new URL('..', import.meta.url).pathname

// ── 1. SVG → 1024×1024 PNG ───────────────────────────────────────────────────
const svg = readFileSync(`${root}build/icon.svg`, 'utf-8')
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } })
const png = resvg.render().asPng()
writeFileSync(`${root}build/icon.png`, png)
console.log('✓ build/icon.png')

// ── 2. PNG → .icns (macOS only) ──────────────────────────────────────────────
if (platform() !== 'darwin') {
  console.log('⚠ Skipping .icns — only supported on macOS')
  process.exit(0)
}

const iconset = `${root}build/icon.iconset`
mkdirSync(iconset, { recursive: true })

const sizes = [16, 32, 128, 256, 512]
for (const size of sizes) {
  const out = `${iconset}/icon_${size}x${size}.png`
  execSync(`sips -z ${size} ${size} "${root}build/icon.png" --out "${out}" > /dev/null`)
  const out2x = `${iconset}/icon_${size}x${size}@2x.png`
  const double = size * 2
  execSync(`sips -z ${double} ${double} "${root}build/icon.png" --out "${out2x}" > /dev/null`)
}

execSync(`iconutil -c icns "${iconset}" -o "${root}build/icon.icns"`)
rmSync(iconset, { recursive: true, force: true })
console.log('✓ build/icon.icns')
