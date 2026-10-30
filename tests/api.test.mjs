import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const { outputText } = ts.transpileModule(
  readFileSync(new URL('../src/api.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
);
const { api } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
);

test('API errors stay readable when an upstream server returns empty or HTML responses', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch');
  for (const body of ['', '<html>Internal Server Error</html>']) {
    fetch.mock.mockImplementation(async () => new Response(body, { status: 500 }));
    await assert.rejects(api('/auth/sign-in/magic-link', {}), /temporairement indisponible/);
  }
  fetch.mock.mockImplementation(async () => new Response('', { status: 429 }));
  await assert.rejects(api('/auth/sign-in/magic-link', {}), /Trop de demandes/);
});

test('API preserves structured errors and rejects empty success responses', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      { error: 'La connexion par courriel n’est pas encore activée.' },
      { status: 503 },
    ),
  );
  await assert.rejects(api('/auth/sign-in/magic-link', {}), /courriel n’est pas encore activée/);
  fetch.mock.mockImplementation(async () => new Response(''));
  await assert.rejects(api('/auth/sign-in/magic-link', {}), /réponse inattendue/);
  fetch.mock.mockImplementation(async () => Response.json({ status: true }));
  assert.deepEqual(await api('/auth/sign-in/magic-link', {}), { status: true });
});
