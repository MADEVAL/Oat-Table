const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync(path.resolve(__dirname, '../src/table.js'), 'utf8');

function setup(body) {
  const dom = new JSDOM(`<!doctype html><html><body>${body}</body></html>`, {
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    url: 'https://example.test/'
  });

  dom.window.console.warn = () => {};
  dom.window.eval(source);
  return dom;
}

function click(window, element) {
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

function change(window, element) {
  element.dispatchEvent(new window.Event('change', { bubbles: true }));
}

function input(window, element, value) {
  element.value = value;
  element.dispatchEvent(new window.Event('input', { bubbles: true }));
}

function rowLabels(document) {
  return Array.from(document.querySelectorAll('tbody tr:not([data-table-empty])'))
    .map(row => row.cells[1]?.textContent.trim() || row.cells[0].textContent.trim());
}

function fixture() {
  return `
    <ot-table empty-text="Nothing here">
      <form data-table-toolbar role="search">
        <input type="search" data-table-filter>
        <output data-table-selected></output>
        <output data-table-status></output>
      </form>
      <div class="table">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" data-table-select-all></th>
              <th data-sort>Name</th>
              <th data-sort="number">Tickets</th>
              <th data-sort="date">Last seen</th>
            </tr>
          </thead>
          <tbody>
            <tr data-filter-text="charlie admin active">
              <td><input type="checkbox" data-table-select-row value="charlie"></td>
              <td>Charlie</td>
              <td data-sort-value="14">14 tickets</td>
              <td><time datetime="2026-05-11">May 11</time></td>
            </tr>
            <tr data-filter-text="ada editor active">
              <td><input type="checkbox" data-table-select-row value="ada"></td>
              <td>Ada</td>
              <td data-sort-value="2">2 tickets</td>
              <td><time datetime="2026-05-16">May 16</time></td>
            </tr>
            <tr data-filter-text="bravo viewer pending">
              <td><input type="checkbox" data-table-select-row value="bravo"></td>
              <td>Bravo</td>
              <td data-sort-value="8">8 tickets</td>
              <td><time datetime="2026-04-02">Apr 2</time></td>
            </tr>
          </tbody>
        </table>
      </div>
    </ot-table>
  `;
}

test('enhances sortable headers with buttons and aria-sort', () => {
  const dom = setup(fixture());
  const { document } = dom.window;
  const table = document.querySelector('ot-table');
  const headers = document.querySelectorAll('th[data-sort]');

  assert.equal(headers.length, 3);
  assert.equal(headers[0].scope, 'col');
  assert.ok(headers[0].querySelector('button[data-table-sort-button]'));

  const events = [];
  table.addEventListener('ot-table-sort', event => events.push(event.detail));

  click(dom.window, headers[0].querySelector('button'));
  assert.deepEqual(rowLabels(document), ['Ada', 'Bravo', 'Charlie']);
  assert.equal(headers[0].getAttribute('aria-sort'), 'ascending');
  assert.equal(events[0].column, 1);
  assert.equal(events[0].direction, 'ascending');

  click(dom.window, headers[0].querySelector('button'));
  assert.deepEqual(rowLabels(document), ['Charlie', 'Bravo', 'Ada']);
  assert.equal(headers[0].getAttribute('aria-sort'), 'descending');
});

test('sorts number and date columns using semantic values', () => {
  const dom = setup(fixture());
  const { document } = dom.window;
  const headers = document.querySelectorAll('th[data-sort]');

  click(dom.window, headers[1].querySelector('button'));
  assert.deepEqual(rowLabels(document), ['Ada', 'Bravo', 'Charlie']);

  click(dom.window, headers[2].querySelector('button'));
  assert.deepEqual(rowLabels(document), ['Bravo', 'Charlie', 'Ada']);
});

test('filters rows, updates status, and renders empty state', () => {
  const dom = setup(fixture());
  const { document } = dom.window;
  const table = document.querySelector('ot-table');
  const filter = document.querySelector('[data-table-filter]');
  const status = document.querySelector('[data-table-status]');
  const events = [];

  table.addEventListener('ot-table-filter', event => events.push(event.detail));

  assert.equal(status.textContent, '3 rows');

  input(dom.window, filter, 'active');
  assert.equal(document.querySelectorAll('tbody tr:not([hidden]):not([data-table-empty])').length, 2);
  assert.equal(status.textContent, '2 of 3 rows');
  assert.equal(events[0].query, 'active');
  assert.equal(events[0].visibleRows.length, 2);

  input(dom.window, filter, 'missing');
  assert.equal(document.querySelectorAll('tbody tr:not([hidden]):not([data-table-empty])').length, 0);
  assert.equal(document.querySelector('[data-table-empty] td').textContent, 'Nothing here');
  assert.equal(status.textContent, '0 of 3 rows');

  input(dom.window, filter, '');
  assert.equal(document.querySelectorAll('[data-table-empty]').length, 0);
  assert.equal(status.textContent, '3 rows');
});

test('selects rows with native checkboxes and keeps select-all scoped to visible rows', () => {
  const dom = setup(fixture());
  const { document } = dom.window;
  const table = document.querySelector('ot-table');
  const filter = document.querySelector('[data-table-filter]');
  const selectAll = document.querySelector('[data-table-select-all]');
  const selectedStatus = document.querySelector('[data-table-selected]');
  const events = [];

  table.addEventListener('ot-table-select', event => events.push(event.detail));

  input(dom.window, filter, 'active');
  selectAll.checked = true;
  change(dom.window, selectAll);

  assert.equal(selectedStatus.textContent, '2 selected');
  assert.deepEqual(Array.from(events[0].selectedValues).sort(), ['ada', 'charlie']);
  assert.equal(selectAll.checked, true);
  assert.equal(selectAll.indeterminate, false);

  const ada = document.querySelector('[value="ada"]');
  ada.checked = false;
  change(dom.window, ada);

  assert.equal(selectedStatus.textContent, '1 selected');
  assert.equal(selectAll.checked, false);
  assert.equal(selectAll.indeterminate, true);
  assert.equal(ada.closest('tr').hasAttribute('data-selected'), false);
});

test('refresh picks up rows added after initialization', () => {
  const dom = setup(fixture());
  const { document } = dom.window;
  const table = document.querySelector('ot-table');
  const tbody = document.querySelector('tbody');

  tbody.insertAdjacentHTML('beforeend', `
    <tr data-filter-text="delta owner active">
      <td><input type="checkbox" data-table-select-row value="delta"></td>
      <td>Delta</td>
      <td data-sort-value="1">1 ticket</td>
      <td><time datetime="2026-06-01">Jun 1</time></td>
    </tr>
  `);

  table.refresh();
  click(dom.window, document.querySelectorAll('th[data-sort]')[1].querySelector('button'));

  assert.deepEqual(rowLabels(document), ['Delta', 'Ada', 'Bravo', 'Charlie']);
  assert.equal(document.querySelector('[data-table-status]').textContent, '4 rows');
});

test('refresh can also be requested with ot-table-refresh', () => {
  const dom = setup(fixture());
  const { document, CustomEvent } = dom.window;
  const table = document.querySelector('ot-table');
  const tbody = document.querySelector('tbody');

  tbody.insertAdjacentHTML('beforeend', `
    <tr data-filter-text="echo active">
      <td><input type="checkbox" data-table-select-row value="echo"></td>
      <td>Echo</td>
      <td data-sort-value="20">20 tickets</td>
      <td><time datetime="2026-06-02">Jun 2</time></td>
    </tr>
  `);

  table.dispatchEvent(new CustomEvent('ot-table-refresh'));
  assert.equal(document.querySelector('[data-table-status]').textContent, '4 rows');
});

test('does not fail when optional controls are absent', () => {
  const dom = setup(`
    <ot-table>
      <table>
        <thead><tr><th data-sort>Name</th></tr></thead>
        <tbody><tr><td>Plain row</td></tr></tbody>
      </table>
    </ot-table>
  `);

  const { document } = dom.window;
  click(dom.window, document.querySelector('button[data-table-sort-button]'));
  assert.equal(document.querySelector('tbody tr td').textContent, 'Plain row');
});