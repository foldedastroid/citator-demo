const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  let factory;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/alpine/components/search_filter.js'), 'utf8'), {
    document: { addEventListener: (_, listener) => listener() },
    Alpine: { data: (_, value) => { factory = value; } },
  });
  const state = factory();
  const tab = { querySelectorAll: () => [] };
  const panel = { querySelectorAll: () => ['ca1', 'ca2'].map(courtKey => ({ dataset: { courtKey } })) };
  state.pickerTab = 'federal';
  state.$root = { querySelector: selector => selector === '[role="tabpanel"][data-tab-key="federal"]' ? panel : tab };
  const changes = [];
  state.changed = () => changes.push([...state.selectedCourts]);
  return { state, changes, panel };
}

test('active-tab bulk selection resolves the panel after its tab button and includes name-filtered courts', () => {
  const { state, changes, panel } = fixture();
  state.selectedCourts = ['cal', 'ca1'];
  state.pickerQuery = 'first';
  state.query = 'Henry';
  assert.equal(state.currentPanel(), panel);
  state.checkTabCourts();
  assert.deepEqual([...state.selectedCourts], ['cal', 'ca1', 'ca2']);
  assert.equal(state.pickerQuery, 'first');
  assert.equal(state.query, 'Henry');
  assert.equal(changes.length, 1);
});

test('clearing the active tab preserves courts selected in other tabs', () => {
  const { state, changes } = fixture();
  state.selectedCourts = ['ca1', 'cal', 'ca2'];
  state.pickerQuery = 'first';
  state.clearTabCourts();
  assert.deepEqual([...state.selectedCourts], ['cal']);
  assert.equal(state.pickerQuery, 'first');
  assert.equal(changes.length, 1);
});

test('unavailable tab panels do not change selected courts', () => {
  const { state, changes } = fixture();
  state.$root.querySelector = () => null;
  state.selectedCourts = ['cal'];
  state.checkTabCourts();
  state.clearTabCourts();
  assert.deepEqual([...state.selectedCourts], ['cal']);
  assert.equal(changes.length, 0);
});
