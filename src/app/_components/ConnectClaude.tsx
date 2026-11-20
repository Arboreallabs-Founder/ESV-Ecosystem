'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './ConnectClaude.module.css'

/**
 * "Connect Claude" — shows an employee how to add Ecosystem as a connector in their own Claude.
 *
 * There is no link that adds a custom connector for someone, so this is a how-to with the URL to
 * copy, not a one-click install. The sign-in and permissions all happen on the Claude side and on
 * /oauth/consent; see docs/MCP.md.
 *
 * Internal roles only — the consent screen refuses partners anyway, so offering it would be a dead end.
 */
export const CONNECT_CLAUDE_ROLES = ['founder', 'admin', 'associate', 'general', 'hr']

const CLAUDE_CONNECTORS_URL = 'https://claude.ai/settings/connectors'

const EXAMPLES = [
  'What are my open tasks this week?',
  'Mark the Acme follow-up done and comment that the deck was sent.',
  'Add a task for me to call the founders of Zeta on Friday.',
  'Pull up the company profile for Zeta: stage, ARR and current raise.',
]

export default function ConnectClaude({ buttonClassName, iconSize = 18 }: {
  buttonClassName: string
  iconSize?: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => setOpen(true)}
        aria-label="Connect Claude"
        title="Connect Claude to Ecosystem"
      >
        <SparkIcon size={iconSize} />
      </button>
      {open && <ConnectModal onClose={() => setOpen(false)} />}
    </>
  )
}

function ConnectModal({ onClose }: { onClose: () => void }) {
  // Read on the client, so a preview deployment hands out its own URL rather than production's.
  const mcpUrl = `${window.location.origin}/api/mcp`
  const cliCommand = `claude mcp add --transport http ecosystem ${mcpUrl}`

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="connect-claude-title">
        <div className={styles.head}>
          <span className={styles.headIcon}><SparkIcon size={20} /></span>
          <div>
            <h2 id="connect-claude-title" className={styles.title}>Connect Claude</h2>
            <p className={styles.sub}>
              Let Claude check your tasks, update them and look up companies for you. It works as
              you, with exactly your access, and asks before it changes anything.
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className={styles.label}>Connector URL</div>
        <CopyField value={mcpUrl} />

        <div className={styles.sectionTitle}>Claude app (web or desktop)</div>
        <ol className={styles.steps}>
          <li>
            Open{' '}
            <a href={CLAUDE_CONNECTORS_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>
              Claude → Settings → Connectors ↗
            </a>
          </li>
          <li>Choose <strong>Add custom connector</strong>, name it <strong>Ecosystem</strong> and paste the URL above.</li>
          <li>Click <strong>Connect</strong>, sign in to Ecosystem if asked, then <strong>Allow</strong>.</li>
        </ol>

        <div className={styles.sectionTitle}>Claude Code</div>
        <CopyField value={cliCommand} mono />
        <p className={styles.hint}>Then run <code>/mcp</code> in Claude Code to sign in.</p>

        <div className={styles.sectionTitle}>Then try asking</div>
        <ul className={styles.examples}>
          {EXAMPLES.map((e) => <li key={e}>&ldquo;{e}&rdquo;</li>)}
        </ul>
      </div>
    </div>,
    document.body,
  )
}

function CopyField({ value, mono = false }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked (insecure context, permissions); the text is selectable anyway.
    }
  }

  return (
    <div className={styles.copyRow}>
      <code className={`${styles.copyValue} ${mono ? styles.copyMono : ''}`}>{value}</code>
      <button type="button" className={styles.copyBtn} onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
    </div>
  )
}

/** A neutral spark mark — deliberately not Claude's logo, which isn't ours to use. */
function SparkIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}
