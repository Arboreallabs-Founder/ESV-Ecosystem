'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { moveDeal, addNote } from '@/app/actions/deals'
import { addOutreach, updateOutreachStatus } from '@/app/actions/investors'
import { DEAL_STAGES, type Deal, type DealNote, type DealDocument, type StageHistoryEntry, type DealStage, type FundOutreach, type Investor } from '@/lib/types'
import styles from './deal-detail.module.css'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

type Tab = 'notes' | 'documents' | 'history' | 'outreach'

const OUTREACH_STATUSES = ['Sent', 'Responded', 'Interested', 'Passed'] as const

export default function DealDetailClient({
  deal: initialDeal,
  notes: initialNotes,
  documents,
  history: initialHistory,
  outreach: initialOutreach,
  investors,
  userRole,
}: {
  deal: Deal
  notes: DealNote[]
  documents: DealDocument[]
  history: StageHistoryEntry[]
  outreach: FundOutreach[]
  investors: Investor[]
  userRole: string
}) {
  const router = useRouter()
  const [deal, setDeal] = useState(initialDeal)
  const [notes, setNotes] = useState(initialNotes)
  const [history, setHistory] = useState(initialHistory)
  const [outreach, setOutreach] = useState(initialOutreach)
  const [activeTab, setActiveTab] = useState<Tab>('notes')
  const [noteText, setNoteText] = useState('')
  const [selectedInvestorId, setSelectedInvestorId] = useState('')
  const [isPending, startTransition] = useTransition()

  const currentIndex = DEAL_STAGES.indexOf(deal.current_stage as DealStage)
  const canAdvance = currentIndex < DEAL_STAGES.length - 1
  const canRegress = currentIndex > 0
  const canEdit = userRole !== 'franchise_partner'

  function handleStageClick(stage: DealStage) {
    if (!canEdit || stage === deal.current_stage) return
    const from = deal.current_stage as DealStage
    setDeal((d) => ({ ...d, current_stage: stage }))
    startTransition(async () => {
      await moveDeal(deal.id, stage, from)
    })
  }

  function handleAddNote() {
    if (!noteText.trim()) return
    const content = noteText.trim()
    setNoteText('')
    startTransition(async () => {
      await addNote(deal.id, content)
      router.refresh()
    })
  }

  function handleAddOutreach() {
    if (!selectedInvestorId) return
    const investor = investors.find((i) => i.id === selectedInvestorId)
    if (!investor) return
    const optimistic: FundOutreach = {
      id: `temp-${Date.now()}`,
      deal_id: deal.id,
      investor_id: selectedInvestorId,
      status: 'Sent',
      updated_by: null,
      updated_at: new Date().toISOString(),
      investor,
    }
    setOutreach((prev) => [optimistic, ...prev])
    setSelectedInvestorId('')
    startTransition(async () => {
      await addOutreach(deal.id, selectedInvestorId)
      router.refresh()
    })
  }

  function handleOutreachStatusChange(outreachId: string, newStatus: string) {
    setOutreach((prev) => prev.map((o) => o.id === outreachId ? { ...o, status: newStatus as FundOutreach['status'] } : o))
    startTransition(async () => {
      await updateOutreachStatus(outreachId, newStatus, deal.id)
    })
  }

  return (
    <div className={styles.page}>
      <Link href="/pipeline" className={styles.backLink}>← Pipeline</Link>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.company}>{deal.company_name}</h1>
          <div className={styles.metaRow}>
            <span className={styles.tag}>{deal.sector}</span>
            <span className={styles.tag}>{deal.funding_stage}</span>
            <span className={styles.tag}>{deal.source}</span>
          </div>
        </div>
      </div>

      {/* Deal info grid */}
      <div className={styles.infoGrid}>
        <div className={styles.infoItem}>
          <div className={styles.infoLabel}>Added</div>
          <div className={styles.infoValue}>{formatDateShort(deal.created_at)}</div>
        </div>
        <div className={styles.infoItem}>
          <div className={styles.infoLabel}>Source</div>
          <div className={styles.infoValue}>{deal.source}</div>
        </div>
        <div className={styles.infoItem}>
          <div className={styles.infoLabel}>Sector</div>
          <div className={styles.infoValue}>{deal.sector}</div>
        </div>
        <div className={styles.infoItem}>
          <div className={styles.infoLabel}>Stage</div>
          <div className={styles.infoValue}>{deal.funding_stage}</div>
        </div>
        {(userRole === 'founder' || userRole === 'admin') && deal.success_fee_pct != null && (
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Success Fee</div>
            <div className={styles.infoValue}>{deal.success_fee_pct}%</div>
          </div>
        )}
      </div>

      {/* Stage stepper */}
      <div className={styles.stageSection}>
        <div className={styles.stageSectionTitle}>Pipeline Stage</div>
        <div className={styles.stageStrip}>
          {DEAL_STAGES.map((stage, i) => (
            <button
              key={stage}
              className={`${styles.stageStep} ${stage === deal.current_stage ? styles.stageStepActive : ''} ${i < currentIndex ? styles.stageStepPast : ''}`}
              onClick={() => handleStageClick(stage)}
              disabled={!canEdit || isPending}
              title={canEdit ? `Move to ${stage}` : ''}
            >
              {stage}
            </button>
          ))}
        </div>
        {canEdit && (
          <div className={styles.stageActions}>
            <button
              className={`${styles.stageBtn} ${styles.stageBtnSecondary}`}
              onClick={() => handleStageClick(DEAL_STAGES[currentIndex - 1])}
              disabled={!canRegress || isPending}
            >
              ← Regress
            </button>
            <button
              className={`${styles.stageBtn} ${styles.stageBtnPrimary}`}
              onClick={() => handleStageClick(DEAL_STAGES[currentIndex + 1])}
              disabled={!canAdvance || isPending}
            >
              Advance →
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabBar}>
        {(['notes', 'documents', 'history', 'outreach'] as Tab[]).map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'outreach' ? 'Fund Outreach' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'notes' && notes.length > 0 && ` (${notes.length})`}
            {tab === 'documents' && documents.length > 0 && ` (${documents.length})`}
            {tab === 'outreach' && outreach.length > 0 && ` (${outreach.length})`}
          </button>
        ))}
      </div>

      {/* Notes tab */}
      {activeTab === 'notes' && (
        <>
          {canEdit && (
            <div className={styles.noteForm}>
              <textarea
                className={styles.textarea}
                placeholder="Add a note…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                disabled={isPending}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote() }}
              />
              <button className={styles.addNoteBtn} onClick={handleAddNote} disabled={isPending || !noteText.trim()}>
                {isPending ? 'Saving…' : 'Add Note'}
              </button>
            </div>
          )}
          <div className={styles.noteList}>
            {notes.length === 0 ? (
              <div className={styles.empty}>No notes yet.</div>
            ) : (
              notes.map((note) => (
                <div key={note.id} className={styles.noteCard}>
                  <div className={styles.noteContent}>{note.content}</div>
                  <div className={styles.noteMeta}>
                    {note.author?.name ?? 'Unknown'} · {formatDate(note.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Documents tab */}
      {activeTab === 'documents' && (
        <div className={styles.docList}>
          {documents.length === 0 ? (
            <div className={styles.empty}>No documents attached.</div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className={styles.docCard}>
                <div className={styles.docName}>{doc.file_name}</div>
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className={styles.docLink}>
                  View ↗
                </a>
              </div>
            ))
          )}
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className={styles.timeline}>
          {history.length === 0 ? (
            <div className={styles.empty}>No stage history yet.</div>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className={styles.timelineItem}>
                <div className={styles.timelineDot} />
                <div className={styles.timelineContent}>
                  <div className={styles.timelineStage}>
                    {entry.from_stage ? `${entry.from_stage} → ${entry.to_stage}` : `Created at ${entry.to_stage}`}
                  </div>
                  <div className={styles.timelineMeta}>
                    {entry.changer?.name ?? 'Unknown'} · {formatDate(entry.changed_at)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Fund Outreach tab */}
      {activeTab === 'outreach' && (
        <div>
          {canEdit && (
            <div className={styles.noteForm} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <select
                style={{
                  flex: 1,
                  padding: '0.5625rem 0.875rem',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: '8px',
                  background: 'var(--color-bg)',
                  color: selectedInvestorId ? 'var(--color-text)' : 'var(--color-muted)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
                value={selectedInvestorId}
                onChange={(e) => setSelectedInvestorId(e.target.value)}
                disabled={isPending}
              >
                <option value="">Select investor to add…</option>
                {investors
                  .filter((inv) => !outreach.some((o) => o.investor_id === inv.id))
                  .map((inv) => (
                    <option key={inv.id} value={inv.id}>{inv.fund_name} — {inv.contact_name}</option>
                  ))}
              </select>
              <button
                className={styles.addNoteBtn}
                onClick={handleAddOutreach}
                disabled={isPending || !selectedInvestorId}
              >
                Add to Outreach
              </button>
            </div>
          )}
          <div className={styles.noteList}>
            {outreach.length === 0 ? (
              <div className={styles.empty}>No investor outreach tracked yet.</div>
            ) : (
              outreach.map((o) => (
                <div key={o.id} className={styles.noteCard} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)' }}>
                      {o.investor?.fund_name ?? 'Unknown Fund'}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
                      {o.investor?.contact_name} · Updated {formatDateShort(o.updated_at)}
                    </div>
                  </div>
                  <select
                    style={{
                      padding: '0.3125rem 0.625rem',
                      border: '1.5px solid var(--color-border)',
                      borderRadius: '6px',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                    value={o.status}
                    onChange={(e) => handleOutreachStatusChange(o.id, e.target.value)}
                    disabled={isPending || !canEdit}
                  >
                    {OUTREACH_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
