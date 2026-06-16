import Link from 'next/link'
import { listOrganizations } from '@/app/actions/super-admin'
import styles from '../../super-admin.module.css'

export default async function OrgsPage() {
  const orgs = await listOrganizations()

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Organisations</h1>
          <p className={styles.pageSubtitle}>{orgs.length} tenant{orgs.length !== 1 ? 's' : ''} on the platform</p>
        </div>
        <Link href="/super-admin/orgs/new" className={styles.primaryBtn}>
          + New Org
        </Link>
      </div>

      <div className={styles.card}>
        {orgs.length === 0 ? (
          <div className={styles.emptyState}>No organisations yet. Create one to get started.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Users</th>
                <th>Pipelines</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id}>
                  <td>
                    <Link href={`/super-admin/orgs/${org.id}`} className={styles.orgLink}>
                      {org.name}
                    </Link>
                  </td>
                  <td><span className={styles.slug}>{org.slug}</span></td>
                  <td><span className={styles.countBadge}>{org.userCount}</span></td>
                  <td><span className={styles.countBadge}>{org.pipelineCount}</span></td>
                  <td style={{ color: 'var(--color-muted)', fontSize: '0.8125rem' }}>
                    {new Date(org.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
