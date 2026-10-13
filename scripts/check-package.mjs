// Guard against publishing a polluted package.json.
//
// `npm init` run inside a project that already has node_modules copies
// every installed package that is not in devDependencies (i.e. the whole
// transitive tree of vite/vitest/jsdom/grapesjs) into "dependencies" and
// adds "directories". That is how 1.0.0 ended up on npm with 86 runtime
// dependencies. The plugin has no runtime dependencies: grapesjs is a
// peerDependency and everything else is bundled into dist/.
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const errors = [];

const deps = Object.keys(pkg.dependencies || {});
if (deps.length) {
  errors.push(
    `"dependencies" must be empty, found ${deps.length}: ${deps.slice(0, 8).join(', ')}${deps.length > 8 ? ', ...' : ''}`,
  );
}
if (pkg.directories) errors.push('"directories" should not be set (added by `npm init`).');
if (!pkg.peerDependencies || !pkg.peerDependencies.grapesjs) errors.push('"peerDependencies.grapesjs" is missing.');

if (errors.length) {
  console.error('\npackage.json check failed:\n  - ' + errors.join('\n  - ') + '\n');
  console.error('Fix: npm pkg delete dependencies directories\n');
  process.exit(1);
}
console.log('package.json check: ok (no runtime dependencies)');
