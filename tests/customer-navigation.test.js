const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '..', 'js', 'customer-navigation.js'), 'utf8');

function navigation(hash) {
  const links = ['#discover', '#intention'].map(href => ({
    href,
    classes: new Set(href === '#discover' ? ['is-current'] : []),
    attrs: {},
    getAttribute(name) { return name === 'href' ? this.href : this.attrs[name]; },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    classList: null
  }));
  links.forEach(link => {
    link.classList = { toggle(name, enabled) {
      if (enabled) link.classes.add(name);
      else link.classes.delete(name);
    } };
  });
  const listeners = {};
  const window = {
    location: { hash },
    addEventListener(name, callback) { listeners[name] = callback; }
  };
  const document = {
    querySelectorAll(selector) {
      assert.equal(selector, '.customer-journey-nav a[href^="#"]');
      return links;
    }
  };
  vm.runInNewContext(script, { window, document });
  return { links, window, listeners };
}

test('Discover is selected by default and unknown hashes do not select My DEMEOS', () => {
  for (const hash of ['', '#discover', '#other']) {
    const { links } = navigation(hash);
    assert.equal(links[0].classes.has('is-current'), true);
    assert.equal(links[0].attrs['aria-current'], 'location');
    assert.equal(links[1].classes.has('is-current'), false);
    assert.equal(links[1].attrs['aria-current'], undefined);
  }
});

test('Intention is selected for direct links and updates when hash changes', () => {
  const { links, window, listeners } = navigation('#intention');
  assert.equal(links[0].classes.has('is-current'), false);
  assert.equal(links[1].classes.has('is-current'), true);
  assert.equal(links[1].attrs['aria-current'], 'location');
  window.location.hash = '#discover';
  listeners.hashchange();
  assert.equal(links[0].classes.has('is-current'), true);
  assert.equal(links[1].classes.has('is-current'), false);
  assert.equal(links[1].attrs['aria-current'], undefined);
});
