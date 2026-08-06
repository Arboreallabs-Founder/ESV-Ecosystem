'use client'

import { useRouter } from 'next/navigation'
import type { Form, Pipeline } from '@/lib/types'
import type { ShareLink, ShareableForm } from '@/lib/share-links'
import FormList from './FormList'
import ShareClient from './ShareClient'
import styles from '../forms.module.css'

/**
 * Forms and Share as two tabs on one page.
 *
 * They were separate pages, which put the two halves of the same job in different places: you
 * build a form here and hand it out there. Sharing stays a first-class tab rather than a button
 * buried next to Edit/Build — that burial is why associates never issued a link in the first
 * place, and collapsing the pages must not quietly bring it back.
 *
 * The tab lives in the URL so a link to Share is still a link to Share, and so refreshing keeps
 * you where you were.
 */
export default function FormsShell({
  tab, forms, pipelines, canBuild, canDelete, canShare,
  shareForms, shareLinks, canSeeAll, scope, currentUserId,
}: {
  tab: 'forms' | 'share'
  forms: Form[]
  pipelines: Pipeline[]
  canBuild: boolean
  canDelete: boolean
  canShare: boolean
  shareForms: ShareableForm[]
  shareLinks: ShareLink[]
  canSeeAll: boolean
  scope: 'mine' | 'all'
  currentUserId: string
}) {
  const router = useRouter()

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Forms</h1>
      </header>

      {canShare && (
        <div className={styles.tabs} role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'forms'}
            className={`${styles.tab} ${tab === 'forms' ? styles.tabActive : ''}`}
            onClick={() => router.push('/forms')}
          >
            Forms
          </button>
          <button
            role="tab"
            aria-selected={tab === 'share'}
            className={`${styles.tab} ${tab === 'share' ? styles.tabActive : ''}`}
            onClick={() => router.push('/forms?tab=share')}
          >
            Share
            {shareLinks.length > 0 && <span className={styles.tabCount}>{shareLinks.length}</span>}
          </button>
        </div>
      )}

      {tab === 'share' && canShare ? (
        <ShareClient
          forms={shareForms}
          links={shareLinks}
          canSeeAll={canSeeAll}
          scope={scope}
          currentUserId={currentUserId}
        />
      ) : (
        <FormList forms={forms} pipelines={pipelines} canBuild={canBuild} canDelete={canDelete} />
      )}
    </div>
  )
}
