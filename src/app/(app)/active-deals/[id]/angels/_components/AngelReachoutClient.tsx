'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { alertError } from '@/lib/client-errors'
import {
  commitAngelToDeal, createAngelReachout, setAngelDone, setAngelIncluded, setAngelResponse,
} from '@/app/actions/angel-reachout'
import { ANGEL_METHODS, ANGEL_METHOD_LABELS } from '@/lib/types'
import type { ActiveDealDocument, AngelMethod, AngelReachoutList, UserRow } from '@/lib/types'
import { formatDateTimeIst } from '@/lib/format-datetime'
import Avatar from '@/app/_components/Avatar'
import SharePitch from '@/app/(app)/active-deals/_components/SharePitch'
import { WikiButton } from '@/app/_components/WikiPanel'
import styles from '../angels.module.css'

/**
 * Angel Reachout.
 *
 * The syndicate side, and internal only — there is no founder link here at all. Angels do not run
 * an institutional process, so this deliberately has no status funnel: who reached out, how, when,
 * and what came back is the whole record worth keeping.
 *
 * One list is one collaborative task. Everybody assigned works the same list and ticks people off,
 * rather than forty investors becoming forty task cards nobody can see the shape of.
 */
export default function AngelReachoutClient({
  lists, dealId, dealName, team, documents, companyName, intro, website, companyId,
}: {
  lists: AngelReachoutList[]
  dealId: string
  dealName: string
  team: UserRow[]
  /** For the pitch. The same builder the deal card and deal page use. */
  documents: ActiveDealDocument[]
  companyName: string
  intro: string | null
  website: string | null
  companyId: string | null
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [method, setMethod] = useState<AngelMethod>('whatsapp')
  const [methodOther, setMethodOther] = useState('')
  const [title, setTitle] = useState('')
  const [assignees, setAssignees] = useState<string[]>([])
  const [openList, setOpenList] = useState<string | null>(lists[0]?.id ?? null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pending, start] = useTransition()

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      try { await fn(); router.refresh() } catch (err) { alertError(err) }
    })
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <Link href={`/active-deals/${dealId}`} className={styles.back}>← {dealName}</Link>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Angel reachout</h1>
            <WikiButton sectionKey="angelReachout" />
          </div>
          <p className={styles.sub}>
            Our own angel network, for syndicate deals. Internal only — nothing here is shared with
            the founder. One list is one shared task: tick people off as you reach them and write
            down what they said.
          </p>
        </div>
        <div className={styles.headActions}>
          {/* The message itself, where the work is done. Reaching 145 people means opening this
              once and pasting 145 times — having to go back to the deal page for the text is how
              somebody ends up retyping it from memory halfway down the list. */}
          <SharePitch
            companyName={companyName}
            intro={intro}
            website={website}
            documents={documents}
            companyId={companyId}
            canEditIntro
          />
          <button className={styles.primaryBtn} onClick={() => setCreating((v) => !v)}>
            {creating ? 'Cancel' : '+ New reachout'}
          </button>
        </div>
      </header>

      {creating && (
        <section className={styles.newBlock}>
          <div className={styles.field}>
            <span className={styles.label}>How are you reaching them?</span>
            <div className={styles.methodRow}>
              {ANGEL_METHODS.map((m) => (
                <label key={m} className={method === m ? styles.methodOn : styles.method}>
                  <input type="radio" checked={method === m} onChange={() => setMethod(m)} />
                  {ANGEL_METHOD_LABELS[m]}
                </label>
              ))}
            </div>
          </div>

          {/* Required. "Other" with no detail is a record of nothing three months later. */}
          {method === 'other' && (
            <label className={styles.field}>
              <span className={styles.label}>What method? *</span>
              <input
                className={styles.input}
                value={methodOther}
                onChange={(e) => setMethodOther(e.target.value)}
                placeholder="e.g. at the Bengaluru dinner, via a Telegram group"
              />
            </label>
          )}

          <label className={styles.field}>
            <span className={styles.label}>Name it</span>
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional — defaults to the method"
            />
          </label>

          <div className={styles.field}>
            <span className={styles.label}>Who is working it?</span>
            <div className={styles.assigneeRow}>
              {team.map((u) => (
                <label
                  key={u.id}
                  className={assignees.includes(u.id) ? styles.personOn : styles.person}
                >
                  <input
                    type="checkbox"
                    checked={assignees.includes(u.id)}
                    onChange={() => setAssignees((p) =>
                      p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id])}
                  />
                  <Avatar name={u.name || u.email} photoUrl={u.photo_url} size="xs" />
                  {u.name || u.email}
                </label>
              ))}
            </div>
            <span className={styles.hint}>
              Everyone here can tick investors off the same list. The task lands with the first
              person named.
            </span>
          </div>

          <button
            className={styles.primaryBtn}
            disabled={pending}
            onClick={() => run(async () => {
              await createAngelReachout({
                activeDealId: dealId, method, methodOther, title, assignees,
              })
              setCreating(false); setTitle(''); setMethodOther(''); setAssignees([])
            })}
          >
            {pending ? 'Creating…' : 'Create the list'}
          </button>
          <p className={styles.hint}>
            Every angel in the book starts ticked. Untick anyone you are not approaching this round.
          </p>
        </section>
      )}

      {lists.length === 0 && !creating ? (
        <div className={styles.empty}>
          No reachouts yet. Start one and every angel investor in the book is added, all selected —
          then narrow it down.
        </div>
      ) : (
        lists.map((list) => {
          const included = list.members.filter((m) => m.included)
          const done = included.filter((m) => m.done).length
          const replied = included.filter((m) => m.response).length
          const open = openList === list.id

          return (
            <section key={list.id} className={styles.list}>
              <button className={styles.listHead} onClick={() => setOpenList(open ? null : list.id)}>
                <span className={styles.listTitle}>{list.title ?? 'Reachout'}</span>
                <span className={styles.methodTag}>
                  {list.method === 'other'
                    ? list.method_other
                    : ANGEL_METHOD_LABELS[list.method]}
                </span>
                <span className={styles.progress}>
                  {done}/{included.length} reached · {replied} replied
                </span>
                <span className={styles.listMeta}>
                  {list.created_by_user?.name} · {formatDateTimeIst(list.created_at)}
                </span>
                <span className={open ? styles.chevOpen : styles.chev} aria-hidden="true">▾</span>
              </button>

              {open && <MemberList list={list} dealId={dealId} pending={pending} run={run} />}
            </section>
          )
        })
      )}
    </div>
  )
}

/**
 * The roster, with a search over it.
 *
 * Its own component so the query resets when you switch lists rather than following you into a
 * different roster — and so a keystroke re-renders these rows instead of the whole page.
 *
 * Filtering hides rows; it never changes what is included. The counts in the list header stay
 * computed from the whole roster, because "0/145 reached" must not become "0/3 reached" the moment
 * somebody types a name.
 */
function MemberList({ list, dealId, pending, run }: {
  list: AngelReachoutList
  dealId: string
  pending: boolean
  run: (fn: () => Promise<unknown>) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q
    ? list.members.filter((m) => (m.investor?.name ?? '').toLowerCase().includes(q))
    : list.members

  return (
    <div className={styles.members}>
      <div className={styles.searchRow}>
        <input
          className={styles.search}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this list by name…"
          aria-label="Search angels in this list"
        />
        <span className={styles.searchCount}>
          {q ? `${shown.length} of ${list.members.length}` : `${list.members.length} angels`}
        </span>
      </div>

      {shown.length === 0 ? (
        <div className={styles.noMatch}>No one on this list matches “{query.trim()}”.</div>
      ) : (
        shown.map((m) => (
          <div key={m.id} className={m.included ? styles.member : styles.memberOut}>
            <label className={styles.includeBox} title="On this round?">
              <input
                type="checkbox"
                checked={m.included}
                disabled={pending}
                onChange={() => run(() => setAngelIncluded(m.id, !m.included, dealId))}
              />
            </label>

            <span className={styles.memberName}>{m.investor?.name ?? 'Removed'}</span>

            {m.included && (
              <>
                <button
                  className={m.done ? styles.doneOn : styles.doneOff}
                  disabled={pending}
                  onClick={() => run(() => setAngelDone(m.id, !m.done, dealId))}
                >
                  {m.done ? 'Reached' : 'Mark reached'}
                </button>

                {/* Who did it, because with several people on one list that is the first
                    thing anyone asks afterwards. */}
                {m.done && m.done_by_user && (
                  <span className={styles.byWhom}>
                    <Avatar name={m.done_by_user.name ?? '?'} photoUrl={m.done_by_user.photo_url} size="xs" />
                    {m.done_by_user.name}
                  </span>
                )}

                <input
                  className={styles.responseInput}
                  defaultValue={m.response ?? ''}
                  placeholder="What did they say?"
                  disabled={pending}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== (m.response ?? '').trim()) {
                      run(() => setAngelResponse(m.id, e.target.value, dealId))
                    }
                  }}
                />

                {/* A commitment belongs on the deal's own investor list, so the totals
                    there stay true. Reached from here because this is where you are
                    standing when they say yes. */}
                {m.response && (
                  <button
                    className={styles.commitBtn}
                    disabled={pending}
                    onClick={() => {
                      const raw = prompt(`How much is ${m.investor?.name} in for? (₹)`)
                      const amount = Number((raw ?? '').replace(/[^0-9.]/g, ''))
                      if (!amount) return
                      run(() => commitAngelToDeal({
                        memberId: m.id,
                        investorId: m.investor_id,
                        activeDealId: dealId,
                        amount,
                      }))
                    }}
                  >
                    They&apos;re in
                  </button>
                )}
              </>
            )}
          </div>
        ))
      )}
    </div>
  )
}
