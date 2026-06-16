import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import styles from './super-admin.module.css'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user || user.role !== 'super_admin') redirect('/login')

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.headerBrand}>ESV Platform Admin</span>
        <span className={styles.headerUser}>{user.name}</span>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
