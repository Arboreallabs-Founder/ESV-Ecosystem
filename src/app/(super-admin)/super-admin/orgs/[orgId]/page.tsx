import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listOrganizations, listOrgUsers, listOrgApprovedEmails } from '@/app/actions/super-admin'
import styles from '../../../super-admin.module.css'

const ROLE_LABELS: Record<string, string> = {
  founder: 'Founder',
  admin: 'Admin',
  associate: 'Associate',
  franchise_partner: 'Partner',
  super_admin: 'Platform Admin',
  general: 'General',
}

const ROLE_BADGE_CLASS: Record<string, string> = {
  founder: styles.roleBadgeFounder,
  admin: styles.roleBadgeAdmin,
  associate: styles.roleBadgeAssociate,
  franchise_partner: styles.roleBadgePartner,
  general: styles.roleBadgeGeneral,
}

export default async function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const [orgs, users, approved] = await Promise.all([
    listOrganizations(),
    listOrgUsers(orgId),
    listOrgApprovedEmails(orgId),
  ])

  const org = orgs.find((o) => o.id === orgId)
  if (!org) notFound()

  const activeEmails = new Set(users.map((u) => u.email))
  const pending = approved.filter((a) => !activeEmails.has(a.email))

  return (
    <>
      <Link href="/super-admin/orgs" className={styles.backLink}>
        ← All Organisations
      </Link>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{org.name}</h1>
          <p className={styles.pageSubtitle}>
            <span className={styles.slug}>{org.slug}</span>
            &nbsp;· Created {new Date(org.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <Link href={`/super-admin/orgs/${orgId}/users/new`} className={styles.primaryBtn}>
          + Add User
        </Link>
      </div>

      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active Users</div>
          <div className={styles.statValue}>{users.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pipelines</div>
          <div className={styles.statValue}>{org.pipelineCount}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pending Invites</div>
          <div className={styles.statValue}>{pending.length}</div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Active Users ({users.length})</div>
          {users.length === 0 ? (
            <div className={styles.emptyState}>No users have signed in yet.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td style={{ color: 'var(--color-muted)', fontSize: '0.8125rem' }}>{u.email}</td>
                    <td>
                      <span className={`${styles.roleBadge} ${ROLE_BADGE_CLASS[u.role] ?? ''}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {pending.length > 0 && (
        <div className={styles.section}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Pending Invites ({pending.length})</div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Invited</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((a) => (
                  <tr key={a.email}>
                    <td>{a.name}</td>
                    <td style={{ color: 'var(--color-muted)', fontSize: '0.8125rem' }}>{a.email}</td>
                    <td>
                      <span className={`${styles.roleBadge} ${ROLE_BADGE_CLASS[a.role] ?? ''}`}>
                        {ROLE_LABELS[a.role] ?? a.role}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-muted)', fontSize: '0.8125rem' }}>
                      {new Date(a.added_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
