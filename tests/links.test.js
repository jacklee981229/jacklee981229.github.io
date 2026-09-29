import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isExternal, rehypeExternalLinks } from '../src/lib/links.js';

const SITE = 'https://jacklee981229.github.io';

test('only http(s) links to other sites count as outside links', () => {
  assert.equal(isExternal('https://github.com/jacklee981229', SITE), true);
  assert.equal(isExternal('http://hexo.io/docs/', SITE), true);
  assert.equal(isExternal('HTTPS://Example.com', SITE), true);
  assert.equal(isExternal('https://jacklee981229.github.io/11/', SITE), false);
  assert.equal(isExternal('/tags/hexo/', SITE), false);
  assert.equal(isExternal('#setup', SITE), false);
  assert.equal(isExternal('mailto:jackjiunyihlee@gmail.com', SITE), false);
  assert.equal(isExternal('https://', SITE), false);
});

test('the plugin marks outside links in a post and leaves the rest alone', () => {
  const a = (href) => ({ type: 'element', tagName: 'a', properties: { href }, children: [{ type: 'text', value: href }] });
  const tree = { type: 'root', children: [{ type: 'element', tagName: 'p', properties: {}, children: [a('https://hexo.io/'), a('/2/'), a(`${SITE}/7/`)] }] };
  rehypeExternalLinks({ site: SITE })(tree);
  const [outside, relative, own] = tree.children[0].children;
  assert.deepEqual(outside.properties, { href: 'https://hexo.io/', target: '_blank', rel: ['noopener'], ariaDescribedBy: 'new-tab' });
  assert.deepEqual(relative.properties, { href: '/2/' });
  assert.deepEqual(own.properties, { href: `${SITE}/7/` });
});
