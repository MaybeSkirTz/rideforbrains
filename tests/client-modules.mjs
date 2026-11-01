import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
export function clientModules() {
  const dir = resolve('work/client-access-tests');
  mkdirSync(dir, { recursive: true });
  const paths = {};
  for (const [name, path] of Object.entries({
    api: 'src/api.ts',
    ui: 'src/ui.tsx',
    access: 'shared/admin-access.ts',
    album: 'src/PhotoAlbum.tsx',
    routeGeometry: 'shared/route-map.ts',
    motion: 'shared/motion.ts',
  })) {
    const source = readFileSync(path, 'utf8')
      .replaceAll("'../shared/admin-access'", "'./access.mjs'")
      .replaceAll("'../shared/motion'", "'./motion.mjs'");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
      },
    });
    const target = resolve(dir, name + '.mjs');
    writeFileSync(target, outputText);
    paths[name] = pathToFileURL(target).href;
  }
  return paths;
}
