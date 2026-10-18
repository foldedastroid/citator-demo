const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Tests use the page's ordered production scripts instead of maintaining a second loader list.
function readerScripts() {
  const source = fs.readFileSync(path.join(__dirname, '../src/opinion.njk'), 'utf8');
  const frontmatter = source.split('---')[1];
  const scripts = [...frontmatter.matchAll(/^\s+- (\/assets\/js\/[^\s]+)$/gm)].map(match => match[1].slice(1));
  const last = scripts.indexOf('assets/js/alpine/components/opinion_tabs.js');
  if (last < 0) throw new Error('Opinion controller is missing from the page script order');
  return scripts.slice(0, last + 1);
}

function loadReader(scope) {
  let factory;
  const context = vm.createContext({ ...scope, Alpine: { data(name, value) { if (name === 'opinionTabs') factory = value; } } });
  const scripts = readerScripts();
  for (const file of scripts) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  if (!factory) throw new Error('Opinion controller did not register');
  return { create: () => factory(), context, scripts };
}

module.exports = { loadReader, readerScripts };
