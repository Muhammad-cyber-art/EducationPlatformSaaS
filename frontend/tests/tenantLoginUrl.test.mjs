import test from 'node:test';
import assert from 'node:assert/strict';
import { tenantLoginUrl } from '../src/utils/tenantLoginUrl.js';

test('uses registered production and custom domains over HTTPS', () => {
  assert.equal(tenantLoginUrl('school.chronous.uz', { port: '5173' }), 'https://school.chronous.uz/login');
  assert.equal(tenantLoginUrl('academy.example.org', { port: '' }), 'https://academy.example.org/login');
});
test('keeps localhost development port', () => {
  assert.equal(tenantLoginUrl('school.localhost', { port: '5173' }), 'http://school.localhost:5173/login');
});
test('rejects invalid or injected domains', () => {
  for (const domain of ['', 'https://evil.test', 'good.test@evil.test', 'good.test/path', 'bad..test']) {
    assert.throws(() => tenantLoginUrl(domain, { port: '' }));
  }
});
