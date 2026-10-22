import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sayWaiting, waitingDots } from '../src/lib/waiting.js';

// Just enough of a document for the helpers: elements with children, a class and attributes.
const fakeDocument = () => {
  const make = (tag) => ({
    tag, className: '', attrs: {}, children: [],
    setAttribute(k, v) { this.attrs[k] = v; },
    append(...kids) { this.children.push(...kids); },
    replaceChildren(...kids) { this.children = kids; },
    ownerDocument: null,
  });
  const doc = { createElement: (tag) => Object.assign(make(tag), { ownerDocument: doc }) };
  return doc;
};

test('three dots, hidden from screen readers', () => {
  const dots = waitingDots(fakeDocument());
  assert.equal(dots.className, 'waiting-dots');
  assert.equal(dots.attrs['aria-hidden'], 'true');
  assert.equal(dots.children.length, 3);
  assert.ok(dots.children.every((d) => d.tag === 'i'));
});

test('the words come first and stay plain text, with no ellipsis of their own', () => {
  const doc = fakeDocument();
  const said = doc.createElement('p');
  said.children = ['Thanks!'];
  sayWaiting(said, 'Posting');
  assert.equal(said.children[0], 'Posting');
  assert.equal(said.children[1].className, 'waiting-dots');
});
