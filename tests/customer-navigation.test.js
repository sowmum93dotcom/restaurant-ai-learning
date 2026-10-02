const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '..', 'js', 'customer-navigation.js'), 'utf8');
const customerPage = fs.readFileSync(path.join(__dirname, '..', 'customer.html'), 'utf8');

test('actual customer page loads its active section navigation', () => {
  assert.equal(customerPage.includes('<script src="js/customer-navigation.js"></script>'), true);
});

function navigation(hash, geometry = {}) {
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
  const listeners = {}, frames = [], scrolls = [];
  const section = { hidden: false, getBoundingClientRect() { return { top: geometry.top ?? 119 }; } };
  const window = {
    location: { hash },
    scrollY: geometry.scrollY ?? 0,
    requestAnimationFrame(callback) { frames.push(callback); },
    scrollTo(options) { scrolls.push({ ...options }); },
    addEventListener(name, callback) { listeners[name] = callback; }
  };
  const document = {
    querySelector(selector) { return selector === ".customer-header" ? { getBoundingClientRect() { return { height: geometry.headerHeight ?? 119 }; } } : section; },
    querySelectorAll(selector) {
      assert.equal(selector, '.customer-journey-nav a[href^="#"]');
      return links;
    }
  };
  vm.runInNewContext(script, { window, document });
  return { links, window, listeners, frames, scrolls, section };
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


test('section entry leaves the title below the measured sticky header after the surface is revealed', () => {
  const state = navigation('#intention', { top: 180, scrollY: 300, headerHeight: 119 });
  assert.equal(state.scrolls.length, 0, 'positioning waits for the surface to render');
  state.frames.shift()();
  assert.deepEqual(state.scrolls, [{ top: 361, behavior: 'instant' }]);
  assert.equal(state.links[1].attrs['aria-current'], 'location');
});

test('section positioning never scrolls a hidden surface or beyond the top of the document', () => {
  const hidden = navigation('#discover');hidden.section.hidden = true;hidden.frames.shift()();
  assert.equal(hidden.scrolls.length, 0);
  const top = navigation('#discover', { top: 0, scrollY: 0, headerHeight: 134 });top.frames.shift()();
  assert.deepEqual(top.scrolls, [{ top: 0, behavior: 'instant' }]);
});
