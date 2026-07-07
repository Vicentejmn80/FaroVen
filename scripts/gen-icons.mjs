/**
 * Genera todos los assets de icono de FARO a partir de la imagen fuente.
 * Uso: node scripts/gen-icons.mjs
 */
import Jimp from 'jimp'
import { createWriteStream } from 'node:fs'
import { mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC_IMAGE = path.join(ROOT, 'src/assets/faro-icon-source.png')
const ICONS_DIR = path.join(ROOT, 'public/icons')

const DARK_BG = 0x050A14ff  // --color-base-950 de FARO

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true })
}

async function makeIcon(img, size, outPath) {
  await img.clone().resize(size, size, Jimp.RESIZE_LANCZOS3).writeAsync(outPath)
  console.log(`  ✓ ${outPath.replace(ROOT, '.')}  (${size}×${size})`)
}

async function makeMaskable(img, canvasSize, outPath) {
  // Safe-zone: icono ocupa 80% del canvas (20% de padding para forma circular / squircle)
  const iconSize = Math.round(canvasSize * 0.80)
  const offset = Math.floor((canvasSize - iconSize) / 2)
  const bg = new Jimp(canvasSize, canvasSize, DARK_BG)
  const icon = await img.clone().resize(iconSize, iconSize, Jimp.RESIZE_LANCZOS3)
  bg.composite(icon, offset, offset)
  await bg.writeAsync(outPath)
  console.log(`  ✓ ${outPath.replace(ROOT, '.')}  (maskable ${canvasSize}×${canvasSize})`)
}

async function main() {
  await ensureDir(ICONS_DIR)

  console.log('Cargando imagen fuente…')
  const src = await Jimp.read(SRC_IMAGE)

  console.log('\nGenerando iconos:')

  // Estándar PWA
  await makeIcon(src, 192, path.join(ICONS_DIR, 'icon-192.png'))
  await makeIcon(src, 512, path.join(ICONS_DIR, 'icon-512.png'))

  // Maskable (con padding para safe-zone de Android Adaptive Icons)
  await makeMaskable(src, 512, path.join(ICONS_DIR, 'icon-maskable-512.png'))
  await makeMaskable(src, 192, path.join(ICONS_DIR, 'icon-maskable-192.png'))

  // Apple Touch Icon
  await makeIcon(src, 180, path.join(ICONS_DIR, 'apple-touch-icon.png'))

  // Favicon (varias resoluciones)
  await makeIcon(src, 48, path.join(ICONS_DIR, 'favicon-48.png'))
  await makeIcon(src, 32, path.join(ICONS_DIR, 'favicon-32.png'))
  await makeIcon(src, 16, path.join(ICONS_DIR, 'favicon-16.png'))

  // Splash / OG preview (básico)
  await makeIcon(src, 1024, path.join(ICONS_DIR, 'icon-1024.png'))

  console.log('\nIconos generados correctamente.')
  console.log('Actualiza index.html y vite.config.ts para referenciar los nuevos PNG.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
