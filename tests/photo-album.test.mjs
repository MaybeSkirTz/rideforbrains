import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { clientModules } from './client-modules.mjs';
const { default: Album, slideIndex } = await import(clientModules().album);

test('Album navigation wraps in both directions and handles removing photos', () => {
  assert.equal(slideIndex(0, -1, 12), 11);
  assert.equal(slideIndex(11, 1, 12), 0);
  assert.equal(slideIndex(0, 1, 1), 0);
  assert.equal(slideIndex(0, 1, 0), 0);
});

test('An album keeps one main stage while every photo remains selectable', () => {
  const photos = Array.from({ length: 12 }, (_, i) => ({
    url: '/media/' + i + '.webp',
    alt: 'Photo ' + i,
  }));
  const html = renderToStaticMarkup(React.createElement(Album, { photos }));
  assert.equal((html.match(/class="album-stage"/g) || []).length, 1);
  assert.equal((html.match(/class="album-thumb"/g) || []).length, 12);
  assert.equal((html.match(/aria-current="true"/g) || []).length, 1);
  assert.match(html, /Photo précédente/);
  assert.match(html, /Photo suivante/);
  assert.match(html, /défilement automatique/);
  assert.match(html, /Fermer la photo agrandie/);
  assert.equal(renderToStaticMarkup(React.createElement(Album, { photos: [] })), '');
  const single = renderToStaticMarkup(React.createElement(Album, { photos: photos.slice(0, 1) }));
  assert.doesNotMatch(single, /Photo suivante|défilement automatique/);
});
