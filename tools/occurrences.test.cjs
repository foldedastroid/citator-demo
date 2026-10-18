const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function link(href, name, group) {
  return {
    dataset: group ? { group: String(group), name, url: '/opinion/2/' } : {},
    textContent: name,
    getAttribute: key => key === 'href' ? href : key === 'title' ? name : null,
    focus() { this.focused = true; },
  };
}

function fixture(plain = [], groups = []) {
  let factory;
  const flashed = [];
  const destination = { focus() { this.focused = true; } };
  const context = {
    document: { addEventListener: (_, callback) => callback(), getElementById: () => destination },
    Alpine: { data: (_, value) => { factory = value; } },
    highlightElement: value => flashed.push(value),
    clearTimeout() {},
    setTimeout() { throw new Error('Pinned navigation must not schedule dismissal'); },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/alpine/components/opinion_tabs.js'), 'utf8'), context);
  const state = factory();
  state.$nextTick = callback => callback();
  state.pageRoot = { querySelectorAll: selector => selector.includes('[data-group=') ? groups : plain };
  state.$refs = { occPills: { replaceChildren() {} }, occPillsPlain: { replaceChildren() {} } };
  state.occLocate = () => {};
  return { state, flashed, destination };
}

test('plain linked citations navigate exact destinations without inventing treatment analysis', () => {
  const first = link('/opinion/118449/', 'Saucier v. Katz');
  const second = link('/opinion/118449/', 'Saucier');
  const other = link('/opinion/110763/', 'Harlow');
  const { state, flashed } = fixture([first, second, other]);
  state.occOpen(first, true);
  assert.equal(state.occNavCount, 'Occurrence 1 of 2');
  assert.equal(state.occNavUnknown, true);
  assert.equal(state.occNavHasAnalysis, false);
  assert.equal(state.occNavHasRow, false);
  assert.equal(state.occNavUrl, '/opinion/118449/');
  state.occNext();
  assert.equal(state.occNavCount, 'Occurrence 2 of 2');
  assert.equal(flashed.at(-1), second);
  state.occNext();
  assert.equal(flashed.at(-1), first);
  state.occPrev();
  assert.equal(flashed.at(-1), second);
  state.occRelease();
  state.occOpen(other);
  assert.equal(state.occNavUrl, '/opinion/118449/');
});

test('grouped citations retain occurrence position, evidence and the complete analysis destination', () => {
  const links = Array.from({ length: 31 }, () => link('#authority-7', 'Example authority', 7));
  const { state, flashed, destination } = fixture([], links);
  state.occRowLead = n => {
    assert.equal(n, 7);
    return { hasAnalysis: true, rationale: 'Fixture rationale', quote: 'Fixture excerpt', items: 1, item: 0 };
  };
  state.occOpen(links[15]);
  assert.equal(state.occNavCount, 'Occurrence 16 of 31');
  state.occOpen(links[15], true);
  assert.equal(flashed.at(-1), links[15]);
  state.occNext();
  assert.equal(state.occNavCount, 'Occurrence 17 of 31');
  assert.equal(flashed.at(-1), links[16]);
  assert.equal(state.occNavRationale, 'Fixture rationale');
  assert.equal(state.occNavQuote, 'Fixture excerpt');
  assert.equal(state.occNavHasRow, true);
  const calls = [];
  state.enterTab = (tab, hash) => calls.push([tab, hash]);
  state.handleHash = hash => calls.push(hash);
  state.occToRow();
  assert.equal(state.occNav.open, false);
  assert.equal(state.occPinned, false);
  assert.deepEqual(calls, [['authorities', 'authority-7'], 'authority-7']);
  assert.equal(destination.focused, true);
});

test('modifier-click keeps native case navigation and ordinary click pins the occurrence control', () => {
  const citation = link('/opinion/118449/', 'Saucier');
  const { state } = fixture([citation]);
  let prevented = 0;
  const event = { target: { closest: () => citation }, detail: 1, preventDefault: () => prevented++ };
  state.onCitationClick({ ...event, metaKey: true });
  state.onCitationClick({ ...event, ctrlKey: true });
  assert.equal(prevented, 0);
  assert.equal(state.occNav.open, false);
  state.onCitationClick(event);
  assert.equal(prevented, 1);
  assert.equal(state.occPinned, true);
  assert.equal(state.occNavCount, 'Only occurrence');
});
