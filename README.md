# Oat Table

> Semantic table enhancement for [Oat UI](https://github.com/knadh/oat). Sort, filter, and select rows without turning tables into a framework widget.

Oat Table is a small, zero-runtime-dependency extension for Oat. It keeps the native `<table>` as the source of truth and adds progressive behavior around it:

- sortable columns via `th[data-sort]`
- client-side filtering via `[data-table-filter]`
- row selection via native checkboxes
- empty and status output helpers
- Oat theme variables and component layers

The table remains readable and usable without JavaScript. With JavaScript enabled, `<ot-table>` wires up keyboard-friendly sort buttons, ARIA sort state, filter state, selection state, and events.

## Install

```html
<link rel="stylesheet" href="https://oat.ink/oat.min.css">
<link rel="stylesheet" href="./dist/oat-table.min.css">
<script src="https://oat.ink/oat.min.js" defer></script>
<script src="./dist/oat-table.min.js" defer></script>
```

Or with npm once published:

```bash
npm install @oat-ui/oat-table
```

```js
import '@oat-ui/oat-table/dist/oat-table.min.css';
import '@oat-ui/oat-table/dist/oat-table.min.js';
```

## Basic Usage

```html
<ot-table>
  <form data-table-toolbar role="search">
    <label>
      Search
      <input type="search" data-table-filter placeholder="Filter rows">
    </label>
    <output data-table-status aria-live="polite"></output>
  </form>

  <div class="table">
    <table>
      <thead>
        <tr>
          <th scope="col" data-sort>Name</th>
          <th scope="col" data-sort="number">Open tickets</th>
          <th scope="col" data-sort="date">Last seen</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Ada Lovelace</td>
          <td>4</td>
          <td><time datetime="2026-05-15">15 May 2026</time></td>
        </tr>
        <tr>
          <td>Grace Hopper</td>
          <td>12</td>
          <td><time datetime="2026-05-10">10 May 2026</time></td>
        </tr>
      </tbody>
    </table>
  </div>
</ot-table>
```

## Sort

Add `data-sort` to a header cell. Oat Table wraps the header content in a plain button and updates `aria-sort` on the active header.

```html
<th scope="col" data-sort>Name</th>
<th scope="col" data-sort="number">Revenue</th>
<th scope="col" data-sort="date">Created</th>
```

Supported sort types are `text`, `number`, `date`, and `auto`. Empty `data-sort` defaults to `text`.

Use `data-sort-value` on a cell when the visible text is formatted:

```html
<td data-sort-value="42128">$42,128</td>
```

## Filter

Place an input with `data-table-filter` anywhere inside `<ot-table>`.

```html
<input type="search" data-table-filter placeholder="Filter rows">
<output data-table-status aria-live="polite"></output>
```

Filtering matches the row text. Use `data-filter-text` on a row to provide a custom searchable string.

```html
<tr data-filter-text="ada admin active london">
  ...
</tr>
```

Set a custom empty message on the wrapper:

```html
<ot-table empty-text="No customers match this search">
```

## Select Rows

Selection uses native checkboxes. This keeps forms and accessibility straightforward.

```html
<th scope="col"><input type="checkbox" data-table-select-all aria-label="Select all visible rows"></th>

<td>
  <input type="checkbox" data-table-select-row value="customer-1" aria-label="Select Ada Lovelace">
</td>
```

Add an optional selected count output:

```html
<output data-table-selected aria-live="polite"></output>
```

The select-all checkbox affects visible rows only, which makes it work naturally with filtering.

## Attributes

| Attribute | Element | Description |
| --------- | ------- | ----------- |
| `data-sort` | `th` | Enables sorting. Values: `text`, `number`, `date`, `auto`. |
| `data-sort-value` | `td` | Explicit value used for sorting. |
| `data-table-filter` | `input` | Filters rows by text. |
| `data-filter-text` | `tr` | Custom text used for filtering a row. |
| `data-table-status` | `output` | Receives visible row count. |
| `data-table-selected` | `output` | Receives selected row count. |
| `data-table-select-all` | `input[type=checkbox]` | Toggles visible row checkboxes. |
| `data-table-select-row` | `input[type=checkbox]` | Marks a row as selectable. |
| `empty-text` | `ot-table` | Custom empty state text. |

## Events

```js
const table = document.querySelector('ot-table');

table.addEventListener('ot-table-sort', (event) => {
  console.log(event.detail.column, event.detail.direction);
});

table.addEventListener('ot-table-filter', (event) => {
  console.log(event.detail.query, event.detail.visibleRows.length);
});

table.addEventListener('ot-table-select', (event) => {
  console.log(event.detail.selectedValues);
});
```

## Refreshing

If you add or remove rows dynamically, call `refresh()` on the component or dispatch `ot-table-refresh`.

```js
document.querySelector('ot-table').refresh();
```

## Development

```bash
npm install
npm run check
```

`npm run check` builds `dist/` and runs the DOM test suite.

## License

MIT.