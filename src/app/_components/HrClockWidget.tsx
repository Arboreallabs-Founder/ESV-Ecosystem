'use client'

import { useEffect, useState } from 'react'
import type { HrClockSettings, HrBirthday } from '@/lib/types'
import styles from '@/app/app-shell.module.css'

// Minutes since midnight, e.g. '09:30:00' -> 570.
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function currentIstParts(): { hours: number; minutes: number; label: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const hours = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minutes = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  const label = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  return { hours, minutes, label }
}

export default function HrClockWidget({ settings, birthdaysToday }: {
  settings: HrClockSettings
  birthdaysToday: HrBirthday[]
}) {
  const [now, setNow] = useState(() => currentIstParts())

  useEffect(() => {
    const id = setInterval(() => setNow(currentIstParts()), 30_000)
    return () => clearInterval(id)
  }, [])

  const nowMinutes = now.hours * 60 + now.minutes
  const inWindow = (start: string, end: string) => nowMinutes >= toMinutes(start) && nowMinutes < toMinutes(end)
  const isClockIn = inWindow(settings.clock_in_start, settings.clock_in_end)
  const isClockOut = inWindow(settings.clock_out_start, settings.clock_out_end)

  return (
    <div className={styles.hrClockWidget}>
      <div className={styles.hrClockTime}>
        <span className={styles.hrClockDot} />
        {now.label} <span className={styles.hrClockTz}>IST</span>
      </div>
      {(isClockIn || isClockOut || birthdaysToday.length > 0) && (
        <div className={styles.hrClockNotices}>
          {isClockIn && <div className={`${styles.hrClockNotice} ${styles.hrClockNoticeGreen}`}>Clock In</div>}
          {isClockOut && <div className={`${styles.hrClockNotice} ${styles.hrClockNoticeRed}`}>Clock Out</div>}
          {birthdaysToday.map((b) => (
            <div key={b.id} className={`${styles.hrClockNotice} ${styles.hrClockNoticeBirthday}`}>
              🎂 {b.name}&apos;s birthday
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
