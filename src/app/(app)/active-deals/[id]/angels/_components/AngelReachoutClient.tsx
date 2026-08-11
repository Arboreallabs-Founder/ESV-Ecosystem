'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { alertError } from '@/lib/client-errors'
import {
  commitAngelToDeal, createAngelReachout, setAngelDone, setAngelIncluded, setAngelResponse,
} from '@/app/actions/angel-reachout'
import { ANGEL_METHODS, ANGEL_METHOD_LABELS } from '@/lib/types'
import type { AngelMethod, AngelReachoutList, UserRow } from '@/lib/types'
import { formatDateTimeIst } from '@/lib/format-datetime'
import Avatar from '@/app/_components/Avatar'
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
  lists, dealId, dealName, team,
}: {
  lists: AngelReachoutList[]
  dealId: string
  dealName: string
  team: UserRow[]
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
        <button className={styles.primaryBtn} onClick={() => setCreating((v) => !v)}>
          {creating ? 'Cancel' : '+ New reachout'}
        </button>
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

              {open && (
                <div className={styles.members}>
                  {list.members.map((m) => (
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
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
