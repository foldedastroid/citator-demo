





const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const nunjucks = require('nunjucks');
const { chartBreakdown, calendarYear } = require('./chart-data.cjs');
const { centuryRows, denseRows, sparseRows } = require('./chart-examples.cjs');
const context = vm.createContext({ document: { addEventListener() {} } });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/alpine/components/treatment_list.js'), 'utf8'), context);
const visible = (date, period) => context.datePeriodMatches({ date, year: (date || '').slice(0, 4) }, period);
const row = (date, severity = 'Neutral', court = 'Illustrative court') => ({ severity, citing_date_filed: date, citing_court_display: court, court_index: 0 });

test('calendar dates distinguish leap boundaries, invalid dates and missing values', () => {
  assert.equal(calendarYear('2000-02-29'), 2000);
  for (const date of ['1900-02-29', '2025-02-30', '2025-13-01', '2025-00-01', '2025-01-00', '2025', '', null, 'invalid']) {
    assert.equal(calendarYear(date), null);
    assert.equal(visible(date, 'undated'), true);
    assert.equal(visible(date, '2025'), false);
  }
});

test('inclusive ranges include first and last years without leaking adjacent years', () => {
  const rows = [row('1899-12-31'), row('1900-01-01'), row('1909-12-31'), row('1910-01-01')];
  const b = chartBreakdown(rows);
  const middle = b.periodGroups.decade.periods.find(p => p.key === '1900:1909');
  assert.equal(middle.startDate, '1900-01-01');
  assert.equal(middle.endDate, '1909-12-31');
  assert.equal(middle.n, 2);
  assert.deepEqual(rows.map(r => visible(r.citing_date_filed, middle.key)), [false, true, true, false]);
  assert.equal(visible('1900-01-01', '1910:1900'), false);
});

test('sparse century preserves empty intervals and conserves each row once', () => {
  const b = chartBreakdown(sparseRows());
  assert.equal(b.total, 23);
  assert.equal(b.defaultPeriodMode, 'decade');
  assert.equal(b.periodGroups.year.columnCount, 151);
  assert.equal(b.periodGroups.decade.columnCount, 16);
  assert.equal(b.periodGroups.decade.periods.filter(p => p.n === 0).length, 12);
  assert.equal(b.unknownDateCount, 3);
  assert.equal(b.periods.at(-1).key, 'undated');
  for (const group of Object.values(b.periodGroups)) {
    const sum = group.periods.reduce((total, p) => total + p.n, 0) + b.unknownDateCount;
    assert.equal(sum, b.total);
    for (const period of group.periods) assert.equal(b.rows.filter(r => visible(r.citing_date_filed, period.key)).length, period.n);
  }
  assert.equal(b.rows.filter(r => visible(r.citing_date_filed, 'undated')).length, 3);
});

test('dense court and date counts remain exact at different granularities', () => {
  for (const rows of [centuryRows(), denseRows()]) {
    const b = chartBreakdown(rows);
    assert.equal(b.courts.reduce((total, c) => total + c.n, 0), rows.length);
    assert.equal(b.tiers.reduce((total, t) => total + t.n, 0), rows.length);
    for (const group of Object.values(b.periodGroups)) for (const p of group.periods) {
      for (const tier of b.tiers) assert.equal(rows.filter(r => r.severity === tier.tier && visible(r.citing_date_filed, p.key)).length, p.counts[tier.tier]);
    }
  }
  assert.equal(chartBreakdown(denseRows()).courts.length, 64);
});

test('empty data and wide spans stay bounded without invented counts', () => {
  const empty = chartBreakdown([]);
  assert.equal(empty.total, 0);
  assert.equal(empty.periods.length, 0);
  assert.equal(empty.unknownDateCount, 0);
  const wide = chartBreakdown([row('1000-01-01'), row('2025-12-31')]);
  assert.equal(wide.periodGroups.year.available, false);
  assert.equal(wide.periodGroups.year.periods.length, 0);
  assert.ok(wide.periodGroups.century.columnCount <= wide.maxColumns);
  assert.equal(wide.periodGroups.century.periods.reduce((n, p) => n + p.n, 0), 2);
});

test('a tier outside the five signals is reported, not charted, and does not throw', () => {
  const rows = [row('2001-01-01', 'Stop'), row('2002-01-01', 'Other'), row('2003-01-01', null)];
  const b = chartBreakdown(rows);
  assert.equal(b.uncharted, 2);
  assert.equal(b.total, 1);
  assert.equal(b.rows.length, 3);
  assert.equal(b.tiers.reduce((total, t) => total + t.n, 0), 1);
  assert.equal(b.courts.reduce((total, c) => total + c.n, 0), 1);
  assert.equal(b.dateStart, 2001);
  assert.equal(b.dateEnd, 2001);
});

test('range and undated filters clear completely through the real list controller', () => {
  const state = context.treatmentList({ severity: 'severityIndex' });
  state.recount = () => {};
  const el = date => ({ dataset: { date, year: (date || '').slice(0, 4), severity: 'neutral', appliedSeverity: 'neutral', recSeverity: 'none', validation: 'unverified' } });
  state.applyNarrow({ dataset: { narrow: 'neutral', narrowYear: '1900:1909' } });
  assert.equal(state.rowVisible(el('1900-01-01')), true);
  assert.equal(state.rowVisible(el('1910-01-01')), false);
  assert.equal(state.narrowLabel, 'Neutral · 1900–1909');
  state.clearNarrow();
  assert.equal(state.narrowed, false);
  assert.equal(state.rowVisible(el('1910-01-01')), true);
  state.applyNarrow({ dataset: { narrowYear: 'undated' } });
  assert.equal(state.rowVisible(el('2025-02-30')), true);
  assert.equal(state.rowVisible(el('2025-02-28')), false);
  state.clearFilters();
  assert.equal(state.hasFilters, false);
  assert.equal(state.rowVisible(el('2025-02-28')), true);
});

test('the real matrix renders inclusive labels, explicit zero cells and undated controls', () => {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(__dirname, '../_includes')));
  const html = env.renderString('{% from "macros/citing_chart.njk" import citingChart %}{{ citingChart(b) }}', { b: chartBreakdown(sparseRows()) });
  assert.match(html, /1870-01-01 through 1879-12-31, inclusive/);
  assert.match(html, /data-narrow-year="undated"/);
  assert.match(html, /class="cite-chart__zero"/);
  assert.match(html, /<table/);
  assert.match(html, /role="region"/);
  assert.match(html, /tabindex="0"/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});
