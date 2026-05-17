const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

fs.mkdirSync(dist, { recursive: true });

const files = [
  ['src/table.css', 'dist/oat-table.css'],
  ['src/table.js', 'dist/oat-table.js']
];

for (const [from, to] of files) {
  fs.copyFileSync(path.join(root, from), path.join(root, to));
}

esbuild.buildSync({
  entryPoints: [path.join(root, 'src/table.css')],
  outfile: path.join(dist, 'oat-table.min.css'),
  minify: true,
  bundle: true,
  logLevel: 'silent'
});

esbuild.buildSync({
  entryPoints: [path.join(root, 'src/table.js')],
  outfile: path.join(dist, 'oat-table.min.js'),
  minify: true,
  bundle: false,
  logLevel: 'silent'
});

for (const file of ['oat-table.css', 'oat-table.min.css', 'oat-table.js', 'oat-table.min.js']) {
  const size = fs.statSync(path.join(dist, file)).size;
  console.log(`${file}: ${size} bytes`);
}