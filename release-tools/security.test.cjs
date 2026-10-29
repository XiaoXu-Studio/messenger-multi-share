const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const fromAttest = createRequire(path.join(__dirname, 'attest/package.json'));
const merge = fromAttest('deepmerge');
const CachePolicy = fromAttest('http-cache-semantics');

test('installed backports match the reviewed local source byte for byte', () => {
  for (const name of ['deepmerge', 'http-cache-semantics']) {
    assert.deepEqual(fs.readFileSync(fromAttest.resolve(name)), fs.readFileSync(path.join(__dirname, name, 'index.js')));
  }
});

for (const side of ['source', 'target']) {
  for (const nullPrototype of [true, false]) {
    test(`deepmerge protects ${side}, null prototype=${nullPrototype}`, () => {
      const poisoned = JSON.parse('{"__proto__":{"admin":true},"constructor":{"prototype":{"admin":true}},"prototype":{"admin":true},"nested":{"__proto__":{"admin":true}}}');
      const clean = nullPrototype ? Object.create(null) : {};
      const result = side === 'source' ? merge(clean, poisoned) : merge(poisoned, clean);
      assert.equal(Object.getPrototypeOf(result), Object.prototype);
      assert.equal(result.admin, undefined);
      assert.equal(Object.prototype.admin, undefined);
      for (const key of ['__proto__', 'constructor', 'prototype']) assert.equal(Object.hasOwn(result, key), false);
      assert.equal(result.nested.admin, undefined);
    });
  }
}
test('deepmerge preserves normal arrays, symbols, custom merge and merge.all', () => {
  const symbol = Symbol('key');
  assert.deepEqual(merge({ values: [1], inner: { a: 1 } }, { values: [2], inner: { b: 2 }, [symbol]: 'ok' }),
    { values: [1, 2], inner: { a: 1, b: 2 }, [symbol]: 'ok' });
  assert.deepEqual(merge.all([{a: 1}, {b: 2}]), {a: 1, b: 2});
  assert.deepEqual(merge({a: [1]}, {a: [2]}, {arrayMerge: (_, value) => value}), {a: [2]});
});

for (const headers of [
  {'set-cookie': 'test-only=1'}, {'cache-control': 'private, max-age=0'},
  {'cache-control': 'public, max-age=0, proxy-revalidate'}, {'cache-control': 'public, s-maxage=0'},
  {'cache-control': 'no-cache'}, {'cache-control': 'no-store'}
]) {
  test(`max-stale cannot override cache reuse restrictions: ${JSON.stringify(headers)}`, () => {
    const request = { url: 'https://fixture.invalid/', method: 'GET', headers: {host: 'fixture.invalid'} };
    const policy = new CachePolicy(request, {status: 200, headers}, {shared: true});
    const result = policy.evaluateRequest({...request, headers: {...request.headers, 'cache-control': 'max-stale'}});
    assert.equal(result.response, undefined);
    assert.equal(result.revalidation.synchronous, true);
  });
}
test('ordinary public cached responses still work', () => {
  const request = {url: 'https://fixture.invalid/', headers: {host: 'fixture.invalid'}};
  const policy = new CachePolicy(request, {status: 200, headers: {'cache-control': 'public, max-age=3600'}});
  assert.ok(policy.evaluateRequest(request).response);
});

test('real Sigstore DSSE signing survives core upgrade and binds payload type', async () => {
  const { DSSEBundleBuilder } = fromAttest('@sigstore/sign');
  const { dsse } = fromAttest('@sigstore/core');
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ec', {namedCurve: 'P-256'});
  const publicPem = publicKey.export({format: 'pem', type: 'spki'}).toString();
  const builder = new DSSEBundleBuilder({witnesses: [], signer: {sign: async bytes => ({
    signature: crypto.sign('sha256', bytes, privateKey), key: {$case: 'publicKey', publicKey: publicPem}
  })}});
  const artifact = {data: Buffer.from('{"test":"local-only"}'), type: 'application/vnd.in-toto+json'};
  const bundle = await builder.create(artifact);
  const envelope = bundle.content.dsseEnvelope;
  assert.ok(crypto.verify('sha256', dsse.preAuthEncoding(envelope.payloadType, envelope.payload), publicKey, envelope.signatures[0].sig));
  assert.equal(crypto.verify('sha256', dsse.preAuthEncoding('tampered', envelope.payload), publicKey, envelope.signatures[0].sig), false);
  // UTF-8 byte length, not JS UTF-16 length (the old payload-type binding defect).
  assert.equal(dsse.preAuthEncoding('é', Buffer.from('x')).toString(), 'DSSEv1 2 é 1 x');
});

test('Node installer pins an official archive digest and never runs an unverified installer', () => {
  const installer = fs.readFileSync(path.join(__dirname, 'setup-node.sh'), 'utf8');
  assert.match(installer, /expected=[a-f0-9]{64}/);
  assert.ok(installer.indexOf('sha256sum --check') < installer.indexOf('tar -xJf'));
  assert.match(installer, /--proto '=https'/);
  assert.doesNotMatch(installer, /curl[^\n]*\|\s*(?:ba)?sh/);
});

test('upgraded glob retains synchronous, asynchronous and exclusion semantics', async () => {
  const glob = fromAttest('glob');
  const cwd = path.join(__dirname, 'release/tests');
  assert.deepEqual(glob.globSync('data/**/*.txt', {cwd, posix: true}), ['data/foo/bar.txt']);
  assert.deepEqual(await glob.glob('data/**/*.txt', {cwd, posix: true}), ['data/foo/bar.txt']);
  assert.deepEqual(await glob.glob('data/**/*.txt', {cwd, ignore: 'data/foo/**'}), []);
  const TestExclude = fromAttest('test-exclude');
  const exclude = new TestExclude({cwd, extension: ['.txt'], exclude: []});
  assert.equal(exclude.globSync().length, 1);
  assert.equal((await exclude.glob()).length, 1);
});
