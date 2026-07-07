/**
 * Genera todos los assets de icono de FARO a partir de la imagen fuente.
 * Uso: node scripts/gen-icons.mjs
 */
import Jimp from 'jimp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC_IMAGE = path.join(ROOT, 'src/assets/faro-icon-source.png')
const ICONS_DIR = path.join(ROOT, 'public/icons')

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true })
}

async function makeIcon(img, size, outPath) {
  await img.clone().resize(size, size, Jimp.RESIZE_LANCZOS3).writeAsync(outPath)
  console.log(`  ✓ ${outPath.replace(ROOT, '.')}  (${size}×${size})`)
}

async function makeMaskable(img, canvasSize, outPath) {
  // Full-bleed: la fuente ya trae el squircle azul completo (mismo aspecto que iOS)
  await img.clone().resize(canvasSize, canvasSize, Jimp.RESIZE_LANCZOS3).writeAsync(outPath)
  console.log(`  ✓ ${outPath.replace(ROOT, '.')}  (maskable ${canvasSize}×${canvasSize})`)
}

async function makeMonochrome(img, size, outPath) {
  const icon = await img.clone().resize(size, size, Jimp.RESIZE_LANCZOS3)
  icon.greyscale().contrast(0.35)

  icon.scan(0, 0, icon.bitmap.width, icon.bitmap.height, function (_x, _y, idx) {
    const lum = this.bitmap.data[idx]
    const isMark = lum > 90
    const value = isMark ? 255 : 0
    this.bitmap.data[idx] = value
    this.bitmap.data[idx + 1] = value
    this.bitmap.data[idx + 2] = value
    this.bitmap.data[idx + 3] = isMark ? 255 : 0
  })

  await icon.writeAsync(outPath)
  console.log(`  ✓ ${outPath.replace(ROOT, '.')}  (monochrome ${size}×${size})`)
}

async function main() {
  await ensureDir(ICONS_DIR)

  console.log('Cargando imagen fuente…')
  const src = await Jimp.read(SRC_IMAGE)

  console.log('\nGenerando iconos:')

  await makeIcon(src, 192, path.join(ICONS_DIR, 'icon-192.png'))
  await makeIcon(src, 512, path.join(ICONS_DIR, 'icon-512.png'))

  await makeMaskable(src, 512, path.join(ICONS_DIR, 'icon-maskable-512.png'))
  await makeMaskable(src, 192, path.join(ICONS_DIR, 'icon-maskable-192.png'))

  await makeMonochrome(src, 512, path.join(ICONS_DIR, 'icon-monochrome-512.png'))
  await makeMonochrome(src, 192, path.join(ICONS_DIR, 'icon-monochrome-192.png'))

  await makeIcon(src, 180, path.join(ICONS_DIR, 'apple-touch-icon.png'))

  await makeIcon(src, 48, path.join(ICONS_DIR, 'favicon-48.png'))
  await makeIcon(src, 32, path.join(ICONS_DIR, 'favicon-32.png'))
  await makeIcon(src, 16, path.join(ICONS_DIR, 'favicon-16.png'))

  await makeIcon(src, 1024, path.join(ICONS_DIR, 'icon-1024.png'))

  console.log('\nIconos generados correctamente.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
