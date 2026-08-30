import { SaleItem, ExpenseItem } from '../types';

const SALES_STORAGE_KEY = 'agricarl_sales_data_v2';
const EXPENSES_STORAGE_KEY = 'agricarl_expenses_data_v2';
const DELETED_IDS_KEY = 'agricarl_deleted_item_ids_v1';

const INITIAL_SALES: SaleItem[] = [];

const INITIAL_EXPENSES: ExpenseItem[] = [];

export function getDeletedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function clearDeletedIds() {
  try {
    localStorage.removeItem(DELETED_IDS_KEY);
  } catch (e) {}
}

export function unmarkDeletedId(id: string) {
  try {
    if (!id) return;
    const current = getDeletedIds();
    current.delete(String(id).trim());
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {}
}

export function unmarkDeletedItem(item: { id?: string; series?: string; number?: string; type?: string }) {
  try {
    if (!item) return;
    const current = getDeletedIds();
    if (item.id) current.delete(String(item.id).trim());
    if (item.series && item.number) {
      current.delete(`${item.series}-${item.number}`.toLowerCase().trim());
      current.delete(`sale_${item.series}_${item.number}`.toLowerCase().trim());
      current.delete(`exp_${item.series}_${item.number}`.toLowerCase().trim());
    }
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {}
}

export function addDeletedId(id: string) {
  try {
    const current = getDeletedIds();
    current.add(String(id).trim());
    const arr = Array.from(current).slice(-1000);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(arr));
  } catch (err) {
    console.error('Error saving deleted ID:', err);
  }
}

export function addDeletedIds(ids: string[]) {
  try {
    const current = getDeletedIds();
    ids.forEach(id => {
      if (id) current.add(String(id).trim());
    });
    const arr = Array.from(current).slice(-1000);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(arr));
  } catch (err) {
    console.error('Error saving deleted IDs:', err);
  }
}

export function addDeletedItem(item: { id?: string; series?: string; number?: string; type?: string }) {
  try {
    const current = getDeletedIds();
    if (item.id) current.add(String(item.id).trim());
    if (item.series && item.number) {
      current.add(`${item.series}-${item.number}`.toLowerCase().trim());
      current.add(`sale_${item.series}_${item.number}`.toLowerCase().trim());
      current.add(`exp_${item.series}_${item.number}`.toLowerCase().trim());
    }
    const arr = Array.from(current).slice(-1000);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(arr));
  } catch (err) {
    console.error('Error recording deleted item:', err);
  }
}

export function addDeletedItems(items: Array<{ id?: string; series?: string; number?: string; type?: string }>) {
  try {
    const current = getDeletedIds();
    items.forEach(item => {
      if (item.id) current.add(String(item.id).trim());
      if (item.series && item.number) {
        current.add(`${item.series}-${item.number}`.toLowerCase().trim());
        current.add(`sale_${item.series}_${item.number}`.toLowerCase().trim());
        current.add(`exp_${item.series}_${item.number}`.toLowerCase().trim());
      }
    });
    const arr = Array.from(current).slice(-1000);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(arr));
  } catch (err) {
    console.error('Error recording deleted items:', err);
  }
}

export function loadSales(): SaleItem[] {
  try {
    const raw = localStorage.getItem(SALES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(INITIAL_SALES));
      return INITIAL_SALES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading sales from localStorage:', err);
    return INITIAL_SALES;
  }
}

export function saveSales(data: SaleItem[]) {
  try {
    // Strip heavy base64 strings if data gets too big for localStorage
    const safeData = data.map(item => {
      if (item.storedBase64 && item.storedBase64.length > 30000) {
        if (item.fileUrl) {
          const { storedBase64, storedMimeType, ...rest } = item;
          return rest;
        }
      }
      return item;
    });
    localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(safeData));
  } catch (err) {
    console.error('Error saving sales to localStorage:', err);
    try {
      const stripped = data.map(({ storedBase64, storedMimeType, ...rest }) => rest);
      localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(stripped));
    } catch (e) {}
  }
}

export function loadExpenses(): ExpenseItem[] {
  try {
    const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(INITIAL_EXPENSES));
      return INITIAL_EXPENSES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading expenses from localStorage:', err);
    return INITIAL_EXPENSES;
  }
}

export function saveExpenses(data: ExpenseItem[]) {
  try {
    const safeData = data.map(item => {
      if (item.storedBase64 && item.storedBase64.length > 30000) {
        if (item.fileUrl) {
          const { storedBase64, storedMimeType, ...rest } = item;
          return rest;
        }
      }
      return item;
    });
    localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(safeData));
  } catch (err) {
    console.error('Error saving expenses to localStorage:', err);
    try {
      const stripped = data.map(({ storedBase64, storedMimeType, ...rest }) => rest);
      localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(stripped));
    } catch (e) {}
  }
}

