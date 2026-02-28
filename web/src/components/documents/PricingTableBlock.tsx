'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import type { PricingLineItemInfo } from '@/lib/api';
import {
  getDocumentPricing,
  addPricingItem,
  updatePricingItem,
  deletePricingItem,
  generatePricingFromCards,
} from '@/lib/api';

interface PricingTableBlockProps {
  documentId: string;
  sessionId: string;
}

interface EditableItem extends PricingLineItemInfo {
  _isNew?: boolean;
}

function computeLineTotal(item: EditableItem): number {
  const base = item.quantity * item.unit_price;
  const discounted = base * (1 - item.discount_percent / 100);
  const taxed = discounted * (1 + item.tax_percent / 100);
  return Math.round(taxed * 100) / 100;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

export default function PricingTableBlock({ documentId, sessionId }: PricingTableBlockProps) {
  const [items, setItems] = useState<EditableItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [totalTax, setTotalTax] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [hourlyRate, setHourlyRate] = useState('');
  const [importing, setImporting] = useState(false);

  const fetchPricing = useCallback(async () => {
    try {
      const data = await getDocumentPricing(documentId);
      setItems(data.items);
      setSubtotal(data.subtotal);
      setTotalTax(data.total_tax);
      setGrandTotal(data.grand_total);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch pricing:', err);
      setError('Failed to load pricing data.');
    }
  }, [documentId]);

  useEffect(() => {
    setLoading(true);
    fetchPricing().finally(() => setLoading(false));
  }, [fetchPricing]);

  // Recalculate totals locally when items change
  useEffect(() => {
    const sub = items.reduce((sum, item) => {
      const base = item.quantity * item.unit_price;
      return sum + base * (1 - item.discount_percent / 100);
    }, 0);

    const tax = items.reduce((sum, item) => {
      const base = item.quantity * item.unit_price;
      const discounted = base * (1 - item.discount_percent / 100);
      return sum + discounted * (item.tax_percent / 100);
    }, 0);

    setSubtotal(Math.round(sub * 100) / 100);
    setTotalTax(Math.round(tax * 100) / 100);
    setGrandTotal(Math.round((sub + tax) * 100) / 100);
  }, [items]);

  const handleFieldBlur = async (item: EditableItem, field: string, value: string | number | boolean) => {
    const updates: Record<string, unknown> = { [field]: value };

    if (item._isNew) {
      // Create new item on first blur
      setSavingIds((prev) => new Set(prev).add(item.id));
      try {
        const created = await addPricingItem(documentId, {
          name: item.name,
          description: item.description || undefined,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          tax_percent: item.tax_percent,
          is_optional: item.is_optional,
          order_index: item.order_index,
        });
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...created, _isNew: false } : i)),
        );
      } catch (err) {
        console.error('Failed to add pricing item:', err);
      } finally {
        setSavingIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    } else {
      // Update existing item
      setSavingIds((prev) => new Set(prev).add(item.id));
      try {
        await updatePricingItem(item.id, updates as any);
      } catch (err) {
        console.error('Failed to update pricing item:', err);
      } finally {
        setSavingIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    }
  };

  const handleLocalChange = (itemId: string, field: string, value: string | number | boolean) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const updated = { ...i, [field]: value };
        updated.line_total = computeLineTotal(updated);
        return updated;
      }),
    );
  };

  const handleAddRow = () => {
    const tempId = `temp-${Date.now()}`;
    const newItem: EditableItem = {
      id: tempId,
      document_id: documentId,
      name: '',
      description: null,
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      tax_percent: 0,
      is_optional: false,
      is_selected: true,
      order_index: items.length,
      card_id: null,
      line_total: 0,
      _isNew: true,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleDeleteRow = async (item: EditableItem) => {
    if (item._isNew) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      return;
    }

    try {
      await deletePricingItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      console.error('Failed to delete pricing item:', err);
    }
  };

  const handleImportFromCards = async () => {
    const rate = parseFloat(hourlyRate);
    if (!rate || rate <= 0) return;

    setImporting(true);
    try {
      const importedItems = await generatePricingFromCards(documentId, rate);
      setItems((prev) => [...prev, ...importedItems]);
      setShowImportDialog(false);
      setHourlyRate('');
      // Refresh to get accurate totals from server
      await fetchPricing();
    } catch (err) {
      console.error('Failed to import from cards:', err);
    } finally {
      setImporting(false);
    }
  };

  const handleToggleOptional = (item: EditableItem) => {
    const newValue = !item.is_selected;
    handleLocalChange(item.id, 'is_selected', newValue);
    if (!item._isNew) {
      handleFieldBlur(item, 'is_selected', newValue);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-10 w-full bg-neutral-200 dark:bg-neutral-700 rounded mb-2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Actions Bar */}
      <div className="flex items-center gap-2 p-3 border-b border-neutral-200 dark:border-neutral-700">
        <button
          onClick={handleAddRow}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add Item
        </button>
        <button
          onClick={() => setShowImportDialog(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <ArrowPathIcon className="h-3.5 w-3.5" />
          Import from Planning
        </button>
      </div>

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
          <p className="text-xs text-neutral-700 dark:text-neutral-300 mb-2">
            Enter hourly rate to generate pricing from planning cards:
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <CurrencyDollarIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 py-1.5 pl-7 pr-3 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
              />
            </div>
            <button
              onClick={handleImportFromCards}
              disabled={importing || !hourlyRate}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              {importing ? 'Importing...' : 'Import'}
            </button>
            <button
              onClick={() => {
                setShowImportDialog(false);
                setHourlyRate('');
              }}
              className="rounded-md border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <CurrencyDollarIcon className="h-8 w-8 text-neutral-300 mb-2" />
            <p className="text-sm text-neutral-500 mb-1">No pricing items yet</p>
            <p className="text-xs text-neutral-400">
              Add items manually or import from planning cards.
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className="p-3 space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="group rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors relative"
              >
                {/* Delete Button */}
                <button
                  onClick={() => handleDeleteRow(item)}
                  className="absolute top-2 right-2 rounded-md p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
                  title="Remove item"
                >
                  <TrashIcon className="h-3.5 w-3.5 text-red-500" />
                </button>

                {/* Optional Toggle */}
                {item.is_optional && (
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={item.is_selected}
                      onChange={() => handleToggleOptional(item)}
                      className="h-3.5 w-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
                    />
                    <span className="text-xs text-neutral-500">Optional</span>
                  </div>
                )}

                {/* Item Name */}
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => handleLocalChange(item.id, 'name', e.target.value)}
                  onBlur={() => handleFieldBlur(item, 'name', item.name)}
                  placeholder="Item name"
                  className="w-full text-sm font-medium text-neutral-900 dark:text-neutral-100 bg-transparent border-none outline-none focus:ring-0 placeholder:text-neutral-400 mb-1"
                />

                {/* Description */}
                <input
                  type="text"
                  value={item.description || ''}
                  onChange={(e) => handleLocalChange(item.id, 'description', e.target.value)}
                  onBlur={() => handleFieldBlur(item, 'description', item.description || '')}
                  placeholder="Description (optional)"
                  className="w-full text-xs text-neutral-500 bg-transparent border-none outline-none focus:ring-0 placeholder:text-neutral-400 mb-2"
                />

                {/* Number Fields Row */}
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-xs text-neutral-500 mb-0.5">Qty</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.quantity}
                      onChange={(e) =>
                        handleLocalChange(item.id, 'quantity', parseFloat(e.target.value) || 0)
                      }
                      onBlur={() => handleFieldBlur(item, 'quantity', item.quantity)}
                      className="w-full rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-2 py-1 text-xs text-neutral-900 dark:text-neutral-100 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-0.5">Unit Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) =>
                        handleLocalChange(item.id, 'unit_price', parseFloat(e.target.value) || 0)
                      }
                      onBlur={() => handleFieldBlur(item, 'unit_price', item.unit_price)}
                      className="w-full rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-2 py-1 text-xs text-neutral-900 dark:text-neutral-100 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-0.5">Disc %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={item.discount_percent}
                      onChange={(e) =>
                        handleLocalChange(
                          item.id,
                          'discount_percent',
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      onBlur={() =>
                        handleFieldBlur(item, 'discount_percent', item.discount_percent)
                      }
                      className="w-full rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-2 py-1 text-xs text-neutral-900 dark:text-neutral-100 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-0.5">Tax %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={item.tax_percent}
                      onChange={(e) =>
                        handleLocalChange(item.id, 'tax_percent', parseFloat(e.target.value) || 0)
                      }
                      onBlur={() => handleFieldBlur(item, 'tax_percent', item.tax_percent)}
                      className="w-full rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-2 py-1 text-xs text-neutral-900 dark:text-neutral-100 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                    />
                  </div>
                </div>

                {/* Line Total */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-neutral-500">
                      <input
                        type="checkbox"
                        checked={item.is_optional}
                        onChange={(e) => {
                          handleLocalChange(item.id, 'is_optional', e.target.checked);
                          handleFieldBlur(item, 'is_optional', e.target.checked);
                        }}
                        className="h-3 w-3 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
                      />
                      Optional
                    </label>
                    {savingIds.has(item.id) && (
                      <span className="text-xs text-neutral-400">Saving...</span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(computeLineTotal(item))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      {items.length > 0 && (
        <div className="border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500">Subtotal</span>
            <span className="text-neutral-900 dark:text-neutral-100 font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500">Tax</span>
            <span className="text-neutral-900 dark:text-neutral-100 font-medium">{formatCurrency(totalTax)}</span>
          </div>
          <div className="flex items-center justify-between text-sm pt-1.5 border-t border-neutral-200 dark:border-neutral-700">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">Grand Total</span>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
