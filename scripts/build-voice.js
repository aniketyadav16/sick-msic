const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createHash } = require('node:crypto');
const run = promisify(execFile);
const root = path.resolve(__dirname, '..');
// Keep the signed helper outside synced Documents folders, whose Finder metadata
// can invalidate an app bundle's signature immediately after compilation.
const buildRoot = path.join(os.homedir(), 'Library', 'Caches', 'Aria', 'Voice');
const bundle = path.join(buildRoot, 'Aria Voice.app');
const binary = path.join(bundle, 'Contents', 'MacOS', 'AriaVoice');
let building;
async function buildVoice() {
  if (process.platform !== 'darwin') throw new Error('Native desktop voice search currently requires macOS. Use browser voice search on other platforms.');
  if (building) return building;
  building = (async () => {
    const source = path.join(root, 'native', 'AriaVoice.swift');
    const plist = path.join(root, 'native', 'Info.plist');
    const hash = createHash('sha256').update(await fs.readFile(source)).update(await fs.readFile(plist)).update(process.arch).digest('hex');
    const stamp = path.join(buildRoot, 'voice-build');
    if (await fs.readFile(stamp, 'utf8').catch(() => '') === hash && await fs.stat(binary).catch(() => false)) return binary;
    await fs.mkdir(path.dirname(binary), { recursive: true });
    await fs.copyFile(plist, path.join(bundle, 'Contents', 'Info.plist'));
    try {
      await run('/usr/bin/xcrun', ['swiftc', '-swift-version', '5', '-O', '-module-cache-path', path.join(buildRoot, 'module-cache'),
        source, '-o', binary, '-framework', 'Speech', '-framework', 'AVFoundation',
        '-Xlinker', '-sectcreate', '-Xlinker', '__TEXT', '-Xlinker', '__info_plist', '-Xlinker', plist], { timeout: 120_000 });
      // Generated bundles in synced folders can inherit Finder metadata that codesign rejects.
      await run('/usr/bin/xattr', ['-cr', bundle], { timeout: 10_000 });
      await run('/usr/bin/codesign', ['--force', '--sign', '-', bundle], { timeout: 30_000 });
      await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle], { timeout: 10_000 });
    } catch (error) {
      console.error('Native voice helper build failed:', error.stderr || error.message);
      throw new Error('Could not build macOS voice support. Install Apple Command Line Tools, then run npm run build:voice.');
    }
    await fs.writeFile(stamp, hash);
    return binary;
  })();
  try { return await building; } finally { building = undefined; }
}
if (require.main === module) {
  if (process.platform === 'darwin') buildVoice().then(() => console.log('macOS voice helper ready.')).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { buildVoice };
