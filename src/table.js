(() => {
  const name = 'ot-table';

  if (customElements.get(name)) {
    return;
  }

  class OtTable extends HTMLElement {
    #controller;
    #table;
    #tbody;
    #rows = [];
    #headers = [];
    #filter;
    #status;
    #selectedStatus;
    #selectAll;
    #emptyRow;

    connectedCallback() {
      this.#controller = new AbortController();
      this.#init();
    }

    disconnectedCallback() {
      this.#controller?.abort();
    }

    refresh() {
      if (!this.#table) {
        return;
      }

      this.#rows = Array.from(this.#tbody?.rows || []).filter(row => !row.hasAttribute('data-table-empty'));
      this.#rows.forEach((row, index) => {
        row.dataset.tableIndex = row.dataset.tableIndex || String(index);
      });

      this.#syncSelection();
      this.#applyFilter(false);
    }

    #init() {
      this.#table = this.querySelector('table');
      this.#tbody = this.#table?.tBodies[0];

      if (!this.#table || !this.#tbody) {
        console.warn('ot-table: Missing table or tbody element');
        return;
      }

      this.#filter = this.querySelector('[data-table-filter]');
      this.#status = this.querySelector('[data-table-status]');
      this.#selectedStatus = this.querySelector('[data-table-selected]');
      this.#selectAll = this.querySelector('[data-table-select-all]');

      this.#setupSort();
      this.#setupFilter();
      this.#setupSelection();
      this.addEventListener('ot-table-refresh', () => this.refresh(), { signal: this.#controller.signal });

      this.refresh();
      this.#applyInitialSort();
    }

    #setupSort() {
      this.#headers = Array.from(this.#table.querySelectorAll('thead th[data-sort]'));

      this.#headers.forEach(header => {
        header.scope = header.scope || 'col';

        let button = header.querySelector(':scope > [data-table-sort-button]');
        if (!button) {
          button = document.createElement('button');
          button.type = 'button';
          button.setAttribute('data-table-sort-button', '');

          while (header.firstChild) {
            button.appendChild(header.firstChild);
          }
          header.appendChild(button);
        }

        button.addEventListener('click', () => this.#sortBy(header), { signal: this.#controller.signal });
      });
    }

    #setupFilter() {
      this.#filter?.addEventListener('input', () => this.#applyFilter(), { signal: this.#controller.signal });
    }

    #setupSelection() {
      this.#selectAll?.addEventListener('change', () => this.#toggleVisibleRows(this.#selectAll.checked), { signal: this.#controller.signal });

      this.#table.addEventListener('change', event => {
        const checkbox = event.target.closest('[data-table-select-row]');
        if (!checkbox) {
          return;
        }

        const row = checkbox.closest('tr');
        row?.toggleAttribute('data-selected', checkbox.checked);
        this.#syncSelection();
        this.#emitSelection();
      }, { signal: this.#controller.signal });
    }

    #applyInitialSort() {
      const active = this.#headers.find(header => ['ascending', 'descending'].includes(header.getAttribute('aria-sort')));
      if (!active) {
        return;
      }

      this.#sortBy(active, active.getAttribute('aria-sort'), false);
    }

    #sortBy(header, forcedDirection, emit = true) {
      const column = Array.from(header.parentElement.cells).indexOf(header);
      const current = header.getAttribute('aria-sort');
      const direction = forcedDirection || (current === 'ascending' ? 'descending' : 'ascending');
      const type = header.getAttribute('data-sort') || 'text';
      const factor = direction === 'ascending' ? 1 : -1;

      const sorted = this.#rows.map((row, index) => ({ row, index })).sort((a, b) => {
        const first = this.#sortValue(a.row.cells[column], type);
        const second = this.#sortValue(b.row.cells[column], type);
        const result = this.#compare(first, second);
        return result === 0 ? a.index - b.index : result * factor;
      });

      this.#headers.forEach(item => item.removeAttribute('aria-sort'));
      header.setAttribute('aria-sort', direction);
      sorted.forEach(item => this.#tbody.appendChild(item.row));
      this.#rows = sorted.map(item => item.row);
      this.#applyFilter(false);

      if (emit) {
        this.#emit('ot-table-sort', { column, direction, header });
      }
    }

    #sortValue(cell, type) {
      const raw = (cell?.getAttribute('data-sort-value') || cell?.querySelector('time')?.getAttribute('datetime') || cell?.textContent || '').trim();

      if (type === 'number') {
        const number = Number.parseFloat(raw.replace(/[^0-9.+-]/g, ''));
        return Number.isNaN(number) ? Number.NEGATIVE_INFINITY : number;
      }

      if (type === 'date') {
        const time = Date.parse(raw);
        return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
      }

      if (type === 'auto') {
        const number = Number.parseFloat(raw.replace(/[^0-9.+-]/g, ''));
        if (!Number.isNaN(number) && /\d/.test(raw)) {
          return number;
        }

        const time = Date.parse(raw);
        if (!Number.isNaN(time) && /\d{4}|\d{1,2}[:/-]/.test(raw)) {
          return time;
        }
      }

      return raw.toLocaleLowerCase();
    }

    #compare(first, second) {
      if (typeof first === 'number' && typeof second === 'number') {
        return first - second;
      }

      return String(first).localeCompare(String(second), undefined, { numeric: true, sensitivity: 'base' });
    }

    #applyFilter(emit = true) {
      const query = (this.#filter?.value || '').trim().toLocaleLowerCase();
      let visible = 0;

      this.#rows.forEach(row => {
        const text = (row.getAttribute('data-filter-text') || row.textContent || '').toLocaleLowerCase();
        const match = !query || text.includes(query);
        row.hidden = !match;
        if (match) {
          visible += 1;
        }
      });

      this.#syncEmptyRow(visible);
      this.#syncStatus(visible);
      this.#syncSelection();

      if (emit) {
        this.#emit('ot-table-filter', { query, visibleRows: this.#visibleRows() });
      }
    }

    #syncEmptyRow(visible) {
      if (visible > 0) {
        this.#emptyRow?.remove();
        this.#emptyRow = null;
        return;
      }

      if (!this.#emptyRow) {
        this.#emptyRow = document.createElement('tr');
        this.#emptyRow.setAttribute('data-table-empty', '');

        const cell = document.createElement('td');
        cell.colSpan = Math.max(1, this.#table.tHead?.rows[0]?.cells.length || this.#table.rows[0]?.cells.length || 1);
        cell.textContent = this.getAttribute('empty-text') || 'No rows found.';
        this.#emptyRow.appendChild(cell);
      }

      this.#tbody.appendChild(this.#emptyRow);
    }

    #syncStatus(visible) {
      if (!this.#status) {
        return;
      }

      const total = this.#rows.length;
      this.#status.value = String(visible);
      this.#status.textContent = visible === total ? `${total} rows` : `${visible} of ${total} rows`;
    }

    #toggleVisibleRows(checked) {
      this.#visibleRows().forEach(row => {
        const checkbox = row.querySelector('[data-table-select-row]');
        if (checkbox && !checkbox.disabled) {
          checkbox.checked = checked;
          row.toggleAttribute('data-selected', checked);
        }
      });

      this.#syncSelection();
      this.#emitSelection();
    }

    #syncSelection() {
      const visibleCheckboxes = this.#visibleRows()
        .map(row => row.querySelector('[data-table-select-row]'))
        .filter(checkbox => checkbox && !checkbox.disabled);
      const selectedCheckboxes = this.#rowCheckboxes().filter(checkbox => checkbox.checked);

      this.#rows.forEach(row => {
        const checkbox = row.querySelector('[data-table-select-row]');
        row.toggleAttribute('data-selected', Boolean(checkbox?.checked));
      });

      if (this.#selectAll) {
        const visibleSelected = visibleCheckboxes.filter(checkbox => checkbox.checked).length;
        this.#selectAll.checked = visibleCheckboxes.length > 0 && visibleSelected === visibleCheckboxes.length;
        this.#selectAll.indeterminate = visibleSelected > 0 && visibleSelected < visibleCheckboxes.length;
      }

      if (this.#selectedStatus) {
        const count = selectedCheckboxes.length;
        this.#selectedStatus.value = String(count);
        this.#selectedStatus.textContent = count === 1 ? '1 selected' : `${count} selected`;
      }
    }

    #rowCheckboxes() {
      return this.#rows
        .map(row => row.querySelector('[data-table-select-row]'))
        .filter(Boolean);
    }

    #visibleRows() {
      return this.#rows.filter(row => !row.hidden);
    }

    #emitSelection() {
      const selectedRows = this.#rows.filter(row => row.querySelector('[data-table-select-row]')?.checked);
      const selectedValues = selectedRows.map(row => row.querySelector('[data-table-select-row]').value).filter(Boolean);
      this.#emit('ot-table-select', { selectedRows, selectedValues });
    }

    #emit(type, detail) {
      this.dispatchEvent(new CustomEvent(type, {
        bubbles: true,
        composed: true,
        cancelable: false,
        detail
      }));
    }
  }

  customElements.define(name, OtTable);
})();