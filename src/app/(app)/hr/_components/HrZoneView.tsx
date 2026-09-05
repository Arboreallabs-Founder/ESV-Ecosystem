'use client'

import { describeError } from '@/lib/client-errors'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createHrPolicy, updateHrPolicy, deleteHrPolicy, type HrPolicyInput } from '@/app/actions/hr-zone'
import type { HrPolicy, HrClockSettings, HrBirthday, LeaveRequest, ExpenseRequest, LeaveBalance, EmployeeRow, EmployeeCompensation, UserRow, DocumentType, IssuedDocument } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import { WikiButton } from '@/app/_components/WikiPanel'
import FilterTabs from '@/app/_components/FilterTabs'
import PeopleTab from './PeopleTab'
import DocumentsTab from './DocumentsTab'
import HrClockAdmin from './HrClockAdmin'
import MyRequests from './MyRequests'
import PolicyReader from './PolicyReader'
import { parsePolicy, policyExcerpt, policyOutline } from '@/lib/policy-doc'
import styles from '../hr-zone.module.css'
import policyStyles from '../policy.module.css'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function PolicyCard({ policy, canEdit, canDelete, onOpen, onEdit, onDelete }: {
  policy: HrPolicy; canEdit: boolean; canDelete: boolean
  onOpen: () => void; onEdit: () => void; onDelete: () => void
}) {
  // Parsed for the card too, so the excerpt is the policy's opening sentence rather than
  // whatever markup happens to be on line one, and the count is real sections.
  const blocks = parsePolicy(policy.body)
  const sections = policyOutline(blocks).filter((e) => e.level === 2).length
  const excerpt = policyExcerpt(blocks)

  return (
    <div className={policyStyles.cardShell}>
      <button type="button" className={policyStyles.card} onClick={onOpen}>
        {/* Only the chip goes on the top row — the Edit/Delete tools float there on hover, and
            anything else in that corner is something they would cover up. */}
        <div className={policyStyles.cardTop}>
          <span className={policyStyles.cardChip}>{policy.category || 'Policy'}</span>
        </div>
        <h3 className={policyStyles.cardTitle}>{policy.title}</h3>
        {excerpt && <p className={policyStyles.cardExcerpt}>{excerpt}</p>}
        <div className={policyStyles.cardFoot}>
          {sections > 0 && <span>{sections} sections</span>}
          {sections > 0 && <span aria-hidden="true">·</span>}
          <span>Updated {formatDate(policy.updated_at)}</span>
          <span className={policyStyles.cardRead}>Read →</span>
        </div>
      </button>
      {(canEdit || canDelete) && (
        <div className={policyStyles.cardTools}>
          {canEdit && <button className={policyStyles.toolBtn} onClick={onEdit} title="Edit">Edit</button>}
          {canDelete && <button className={policyStyles.toolBtn} onClick={onDelete} title="Delete">Delete</button>}
        </div>
      )}
    </div>
  )
}

export default function HrZoneView({
  policies, clockSettings, birthdays, canEditPolicies, canDeletePolicies, showClockAdmin,
  isApprover, pendingApprovalsCount, myLeaveRequests, myExpenseRequests, myLeaveBalances, orgId, userId,
  roster, compensation, canManagePeople, managers, profilesOk,
  documentTypes, issuableCodes, issuedDocuments, templateFields, currentUserId,
}: {
  policies: HrPolicy[]; clockSettings: HrClockSettings | null; birthdays: HrBirthday[]
  canEditPolicies: boolean; canDeletePolicies: boolean; showClockAdmin: boolean
  isApprover: boolean; pendingApprovalsCount: number
  myLeaveRequests: LeaveRequest[]; myExpenseRequests: ExpenseRequest[]
  myLeaveBalances: Record<string, LeaveBalance> | null
  orgId: string; userId: string
  roster: EmployeeRow[]
  profilesOk: boolean
  compensation: Record<string, EmployeeCompensation[]>
  canManagePeople: boolean
  managers: UserRow[]
  documentTypes: DocumentType[]
  issuableCodes: string[]
  issuedDocuments: IssuedDocument[]
  templateFields: Record<string, Array<{ name: string; label: string; type: string; required?: boolean; hint?: string }>>
  currentUserId: string
}) {
  const router = useRouter()
  const [readingId, setReadingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<HrPolicy | 'new' | null>(null)
  const reading = policies.find((p) => p.id === readingId) ?? null
  const [, startTransition] = useTransition()

  // Birthdays and clock settings are HR-admin config, not something an associate needs — the tab
  // only exists for people who can see that card at all.
  const showBirthdaysTab = showClockAdmin && !!clockSettings
  const [tab, setTab] = useState<'policies' | 'requests' | 'people' | 'documents' | 'birthdays'>('policies')

  const pendingCount = myLeaveRequests.filter((r) => r.status === 'pending').length
    + myExpenseRequests.filter((r) => r.status === 'pending').length

  function handleDelete(id: string) {
    if (!confirm('Delete this policy?')) return
    startTransition(async () => { await deleteHrPolicy(id); router.refresh() })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className={styles.pageTitle}>HR Zone</div>
            <WikiButton sectionKey="hr" />
          </div>
          <div className={styles.pageSub}>
            {tab === 'policies' ? 'Company policies'
              : tab === 'requests' ? 'Your leave and expense requests'
              : tab === 'people' ? 'Employee records — the data HR letters are generated from'
              : tab === 'documents' ? 'Generate letters on ESV letterhead, each verifiable online'
              : 'Clock reminders and team birthdays'}
          </div>
        </div>
        {/* Only offered on the tab it acts on — a "+ New policy" button above the Birthdays
            list would be a trap. */}
        {canEditPolicies && tab === 'policies' && (
          <button className={styles.primaryBtn} onClick={() => setEditing('new')}>+ New policy</button>
        )}
      </div>

      <FilterTabs
        tabs={[
          { value: 'policies', label: 'Policies', count: policies.length },
          { value: 'requests', label: 'Requests', count: pendingCount || undefined },
          ...(canManagePeople ? [{ value: 'people', label: 'People', count: roster.length }] : []),
          ...(canManagePeople ? [{ value: 'documents', label: 'Documents', count: issuedDocuments.length || undefined }] : []),
          ...(showBirthdaysTab ? [{ value: 'birthdays', label: 'Birthdays', count: birthdays.length }] : []),
        ]}
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
      />

      <div className={styles.content}>
        {tab === 'policies' && (
          <div className={styles.policyListWrap}>
            {policies.length === 0 ? (
              <div className={styles.empty}>No policies published yet.</div>
            ) : (
              <div className={policyStyles.grid}>
                {policies.map((p) => (
                  <PolicyCard
                    key={p.id}
                    policy={p}
                    canEdit={canEditPolicies}
                    canDelete={canDeletePolicies}
                    onOpen={() => setReadingId(p.id)}
                    onEdit={() => setEditing(p)}
                    onDelete={() => handleDelete(p.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'requests' && (
          <>
            {/* Approvers get the queue link here rather than on every tab — it's a request
                surface, so this is where someone is already thinking about them. */}
            {isApprover && (
              <Link href="/approvals" className={styles.clockCard} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
                <span className={styles.clockCardHead} style={{ marginBottom: 0 }}>Approvals</span>
                <span className={styles.pageSub} style={{ marginTop: 0 }}>
                  {pendingApprovalsCount === 0 ? 'Nothing pending' : `${pendingApprovalsCount} pending request${pendingApprovalsCount === 1 ? '' : 's'}`}
                </span>
                <span style={{ marginLeft: 'auto', color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.8125rem' }}>Review →</span>
              </Link>
            )}
            <MyRequests leaveRequests={myLeaveRequests} expenseRequests={myExpenseRequests} leaveBalances={myLeaveBalances} orgId={orgId} userId={userId} />
          </>
        )}

        {tab === 'people' && canManagePeople && (
          <PeopleTab
            roster={roster}
            compensation={compensation}
            canSeeCompensation={canManagePeople}
            managers={managers}
            profilesOk={profilesOk}
          />
        )}

        {tab === 'documents' && canManagePeople && (
          <DocumentsTab
            types={documentTypes}
            issuable={issuableCodes}
            issued={issuedDocuments}
            roster={roster}
            templateFields={templateFields}
            currentUserId={currentUserId}
          />
        )}

        {tab === 'birthdays' && showBirthdaysTab && clockSettings && (
          <HrClockAdmin settings={clockSettings} birthdays={birthdays} canEdit={canEditPolicies} canDelete={canDeletePolicies} />
        )}
      </div>

      {/* Reader closes when the edit modal opens over it — two stacked overlays on the same
          document is one too many, and Save lands you back on the list either way. */}
      {reading && !editing && (
        <PolicyReader
          policy={reading}
          canEdit={canEditPolicies}
          onEdit={() => setEditing(reading)}
          onClose={() => setReadingId(null)}
        />
      )}

      {editing && (
        <HrPolicyModal
          policy={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function HrPolicyModal({ policy, onClose, onSaved }: { policy: HrPolicy | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(policy?.title ?? '')
  const [category, setCategory] = useState(policy?.category ?? '')
  const [body, setBody] = useState(policy?.body ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    if (!title.trim()) { setError('Title is required.'); return }
    if (!body.trim()) { setError('Policy body is required.'); return }
    const input: HrPolicyInput = { title, category: category || null, body }
    startTransition(async () => {
      try {
        if (policy) await updateHrPolicy(policy.id, input)
        else await createHrPolicy(input)
        onSaved()
      } catch (e) { setError(describeError(e).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>{policy ? 'Edit policy' : 'New policy'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Title *</label>
            <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="e.g. Leave Policy" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Category</label>
            <input className={styles.input} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Leave, Conduct, Expenses" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Policy text *</label>
            <textarea className={styles.textarea} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the full policy…" />
            {/* Plain text still works and still reads well — this is what the reader will lay
                out if you use it, not a syntax anyone is obliged to learn. */}
            <div className={styles.fieldHint}>
              Formatting: <code>## Section</code>, <code>### Sub-section</code>, <code>- bullet</code>,
              {' '}<code>1. numbered</code>, <code>&gt; note</code>, <code>**bold**</code>, and
              {' '}<code>| tables |</code>. Blank lines separate paragraphs.
            </div>
          </div>
          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Saving…</span> : policy ? 'Save' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}
