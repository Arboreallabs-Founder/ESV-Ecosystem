'use client'

import { useRef, useState } from 'react'
import styles from './deal-desk.module.css'

// Records a voice note in-browser (MediaRecorder). On stop it hands the recorded Blob
// back to the parent, which uploads it to Supabase Storage when the action is submitted.
export default function VoiceRecorder({
  onRecorded,
  onCleared,
}: {
  onRecorded: (blob: Blob) => void
  onCleared: () => void
}) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function start() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        setUrl(URL.createObjectURL(blob))
        onRecorded(blob)
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      setError('Microphone access was denied.')
    }
  }

  function stop() {
    recorderRef.current?.stop()
    setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  function clear() {
    if (url) URL.revokeObjectURL(url)
    setUrl(null)
    setSeconds(0)
    onCleared()
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div>
      <div className={styles.recorder}>
        {!recording && !url && (
          <button type="button" className={styles.ghostBtn} onClick={start}>● Record voice note</button>
        )}
        {recording && (
          <>
            <span className={styles.recDot} />
            <span className={styles.recTime}>{mmss}</span>
            <button type="button" className={styles.primaryBtn} onClick={stop}>Stop</button>
          </>
        )}
        {url && !recording && (
          <>
            <audio className={styles.audio} src={url} controls />
            <button type="button" className={styles.ghostBtn} onClick={clear}>Re-record</button>
          </>
        )}
      </div>
      {error && <div className={styles.errBox} style={{ marginTop: '0.5rem' }}>{error}</div>}
    </div>
  )
}
