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
      {/* Time and clock-in/out status share one pill — the status is a property of the current
          time, so splitting them into separate floating chips read as two unrelated things.
          Both windows being active at once is only possible if they're configured to overlap;
          rendering both segments surfaces that rather than silently hiding one. */}
      <div className={styles.hrClockPill}>
        <span className={styles.hrClockTime}>
          <span
            className={`${styles.hrClockDot} ${isClockIn ? styles.hrClockDotIn : ''} ${isClockOut ? styles.hrClockDotOut : ''}`}
          />
          {now.label} <span className={styles.hrClockTz}>IST</span>
        </span>
        {isClockIn && <span className={`${styles.hrClockStatus} ${styles.hrClockStatusIn}`}>Clock In</span>}
        {isClockOut && <span className={`${styles.hrClockStatus} ${styles.hrClockStatusOut}`}>Clock Out</span>}
      </div>

      {/* Birthdays stay separate — they're an event, not a state of the clock. */}
      {birthdaysToday.length > 0 && (
        <div className={styles.hrClockNotices}>
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
