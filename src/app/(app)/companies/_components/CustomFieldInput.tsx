'use client'

import { useState } from 'react'
import type { CompanyFieldDef, CompanyFieldType } from '@/lib/types'
import { COMPANY_FIELD_TYPES } from '@/lib/types'
import {
  formatFieldValue, normalizeFieldValue, normalizeFieldConfig, multiSelectValues, isNumericType, isOptionType,
  FieldValueError, FIELD_TYPE_LABELS, CURRENCY_UNIT_LABELS, type CompanyFieldConfig, type CurrencyUnit,
} from '@/lib/company-fields'
import styles from '../companies.module.css'

/**
 * One custom-field editor, for every field type. Behaves like a spreadsheet cell: numbers show
 * formatted (₹12,34,567 · ₹12.35 L · 18.5%) and switch to the raw value while you edit. Dropdowns,
 * multi-selects and checkboxes commit as soon as they change; typed fields on blur.
 *
 * `value` and what `onCommit` receives are the *stored* form (see src/lib/company-fields.ts), so
 * callers never deal with formatting. Invalid input is held back with a message, not committed.
 */
export default function CustomFieldInput({ def, value, onCommit, disabled = false }: {
  def: CompanyFieldDef
  value: string
  onCommit: (stored: string) => void
  disabled?: boolean
}) {
  const type = def.field_type
  const config = def.config ?? {}
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | null>(null)

  function commit(raw: unknown) {
    try {
      const stored = normalizeFieldValue(type, config, raw) ?? ''
      setError(null)
      if (stored !== value) onCommit(stored)
      setDraft(stored)
    } catch (e) {
      setError(e instanceof FieldValueError ? e.message : 'That value is not valid.')
    }
  }

  if (type === 'checkbox') {
    return (
      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={value === 'true'} disabled={disabled} onChange={(e) => commit(e.target.checked)} />
        <span>{value === 'true' ? 'Yes' : 'No'}</span>
      </label>
    )
  }

  if (type === 'select') {
    return (
      <select className={styles.select} value={value} disabled={disabled} onChange={(e) => commit(e.target.value)}>
        <option value="">—</option>
        {(config.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  if (type === 'multi_select') {
    const picked = multiSelectValues(value)
    return (
      <div className={styles.chipToggles}>
        {(config.options ?? []).map((o) => {
          const on = picked.includes(o)
          return (
            <button
              key={o}
              type="button"
              disabled={disabled}
              className={`${styles.chipToggle} ${on ? styles.chipToggleOn : ''}`}
              aria-pressed={on}
              onClick={() => commit(on ? picked.filter((p) => p !== o) : [...picked, o])}
            >
              {o}
            </button>
          )
        })}
      </div>
    )
  }

  if (type === 'long_text') {
    return (
      <>
        <textarea
          className={styles.textarea}
          rows={3}
          disabled={disabled}
          value={focused ? draft : value}
          onFocus={() => { setDraft(value); setFocused(true) }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { setFocused(false); commit(draft) }}
        />
        {error && <div className={styles.fieldError}>{error}</div>}
      </>
    )
  }

  const numeric = isNumericType(type)
  const shown = focused ? draft : (numeric ? formatFieldValue(type, config, value) : value)
  return (
    <>
      <input
        className={styles.input}
        disabled={disabled}
        type={type === 'date' ? 'date' : type === 'email' ? 'email' : type === 'url' ? 'url' : type === 'phone' ? 'tel' : 'text'}
        inputMode={numeric ? 'decimal' : undefined}
        placeholder={type === 'currency' ? 'Amount in ₹, e.g. 2500000' : type === 'percentage' ? 'e.g. 18.5' : undefined}
        value={shown}
        onFocus={() => { setDraft(value); setFocused(true) }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setFocused(false); commit(draft) }}
        onKeyDown={(e) => { if (e.key === 'Enter' && type !== 'date') (e.target as HTMLInputElement).blur() }}
      />
      {error && <div className={styles.fieldError}>{error}</div>}
    </>
  )
}

/**
 * Editor for a field *definition*: label, type and its format (decimals, ₹ unit, thousands
 * separator, dropdown options). Used to add a field and to change an existing one's format.
 */
export function FieldDefEditor({ initial, pending, onSave, onCancel }: {
  initial?: CompanyFieldDef
  pending: boolean
  onSave: (input: { label: string; field_type: CompanyFieldType; config: CompanyFieldConfig }) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [type, setType] = useState<CompanyFieldType>(initial?.field_type ?? 'text')
  const cfg = initial?.config ?? {}
  const [decimals, setDecimals] = useState<string>(cfg.decimals != null ? String(cfg.decimals) : '')
  const [thousands, setThousands] = useState<boolean>(cfg.thousands !== false)
  const [unit, setUnit] = useState<CurrencyUnit>(cfg.unit ?? 'rupees')
  const [options, setOptions] = useState<string>((cfg.options ?? []).join('\n'))
  const [error, setError] = useState<string | null>(null)

  function save() {
    if (!label.trim()) { setError('Give the field a label.'); return }
    const raw: CompanyFieldConfig = {}
    if (isNumericType(type) && decimals !== '') raw.decimals = Number(decimals)
    if (type === 'numeric' || type === 'percentage') raw.thousands = thousands
    if (type === 'currency') raw.unit = unit
    if (isOptionType(type)) raw.options = options.split('\n')
    try {
      const config = normalizeFieldConfig(type, raw)
      setError(null)
      onSave({ label: label.trim(), field_type: type, config })
    } catch (e) {
      setError(e instanceof FieldValueError ? e.message : 'That format is not valid.')
    }
  }

  return (
    <div className={styles.fieldDefEditor}>
      <div className={styles.inlineForm}>
        <input className={styles.input} placeholder="Field label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} />
        <select className={styles.select} value={type} onChange={(e) => setType(e.target.value as CompanyFieldType)}>
          {COMPANY_FIELD_TYPES.map((t) => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
        </select>
      </div>

      {isNumericType(type) && (
        <div className={styles.inlineForm}>
          <label className={styles.fieldDefOpt}>
            Decimals
            <input className={styles.input} type="number" min={0} max={6} placeholder="auto" value={decimals} onChange={(e) => setDecimals(e.target.value)} />
          </label>
          {type === 'currency' ? (
            <label className={styles.fieldDefOpt}>
              Show as
              <select className={styles.select} value={unit} onChange={(e) => setUnit(e.target.value as CurrencyUnit)}>
                {(Object.keys(CURRENCY_UNIT_LABELS) as CurrencyUnit[]).map((u) => <option key={u} value={u}>{CURRENCY_UNIT_LABELS[u]}</option>)}
              </select>
            </label>
          ) : (
            <label className={styles.checkboxRow}>
              <input type="checkbox" checked={thousands} onChange={(e) => setThousands(e.target.checked)} />
              <span>Thousands separator</span>
            </label>
          )}
        </div>
      )}

      {isOptionType(type) && (
        <textarea
          className={styles.textarea}
          rows={4}
          placeholder={'One option per line, e.g.\nSeed\nSeries A\nSeries B'}
          value={options}
          onChange={(e) => setOptions(e.target.value)}
        />
      )}

      {error && <div className={styles.fieldError}>{error}</div>}
      <div className={styles.inlineForm}>
        <button type="button" className={styles.primaryBtn} onClick={save} disabled={pending}>{initial ? 'Save format' : 'Add field'}</button>
        <button type="button" className={styles.ghostBtn} onClick={onCancel} disabled={pending}>Cancel</button>
      </div>
    </div>
  )
}
