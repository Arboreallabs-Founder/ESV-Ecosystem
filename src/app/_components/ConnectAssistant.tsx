'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './ConnectAssistant.module.css'

/**
 * "Connect your AI assistant" — shows an employee how to add Ecosystem as a connector in Claude or
 * ChatGPT, whichever they use. Both speak MCP and both sign in through OAuth, so it is the same
 * /api/mcp URL and the same consent screen either way (see docs/MCP.md).
 *
 * No product offers a link that installs a custom connector for someone, so this is a how-to with
 * the URL to copy, not a one-click install.
 *
 * Internal roles only — the consent screen refuses partners anyway, so offering it would be a dead end.
 */
export const CONNECT_ASSISTANT_ROLES = ['founder', 'admin', 'associate', 'general', 'hr']

type Assistant = 'claude' | 'chatgpt'
const STORAGE_KEY = 'connect-assistant-tab'

const EXAMPLES = [
  'What are my open tasks this week?',
  'Mark the Acme follow-up done and comment that the deck was sent.',
  'Add a task for me to call the founders of Zeta on Friday.',
  'Pull up the company profile for Zeta: stage, ARR and current raise.',
]

export default function ConnectAssistant({ buttonClassName, iconSize = 18 }: {
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
        aria-label="Connect your AI assistant"
        title="Connect Claude or ChatGPT to Ecosystem"
      >
        <SparkIcon size={iconSize} />
      </button>
      {open && <ConnectModal onClose={() => setOpen(false)} />}
    </>
  )
}

function readTab(): Assistant {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'chatgpt' ? 'chatgpt' : 'claude'
  } catch {
    return 'claude'
  }
}

function ConnectModal({ onClose }: { onClose: () => void }) {
  // Read on the client, so a preview deployment hands out its own URL rather than production's.
  const mcpUrl = `${window.location.origin}/api/mcp`
  // Remembered per browser: someone who uses ChatGPT shouldn't have to switch tabs every time.
  const [tab, setTab] = useState<Assistant>(readTab)

  function choose(next: Assistant) {
    setTab(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* private mode etc. — fine to forget */ }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="connect-assistant-title">
        <div className={styles.head}>
          <span className={styles.headIcon}><SparkIcon size={20} /></span>
          <div>
            <h2 id="connect-assistant-title" className={styles.title}>Connect your AI assistant</h2>
            <p className={styles.sub}>
              Let Claude or ChatGPT check your tasks, update them and look up companies for you. It
              works as you, with exactly your access, and asks before it changes anything.
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Assistant">
          <button type="button" role="tab" aria-selected={tab === 'claude'} className={`${styles.tab} ${tab === 'claude' ? styles.tabActive : ''}`} onClick={() => choose('claude')}>Claude</button>
          <button type="button" role="tab" aria-selected={tab === 'chatgpt'} className={`${styles.tab} ${tab === 'chatgpt' ? styles.tabActive : ''}`} onClick={() => choose('chatgpt')}>ChatGPT</button>
        </div>

        <div className={styles.label}>Connector URL</div>
        <CopyField value={mcpUrl} />

        {tab === 'claude' ? <ClaudeSteps mcpUrl={mcpUrl} /> : <ChatGptSteps />}

        <div className={styles.sectionTitle}>Then try asking</div>
        <ul className={styles.examples}>
          {EXAMPLES.map((e) => <li key={e}>&ldquo;{e}&rdquo;</li>)}
        </ul>
      </div>
    </div>,
    document.body,
  )
}

function ClaudeSteps({ mcpUrl }: { mcpUrl: string }) {
  return (
    <>
      <div className={styles.sectionTitle}>Claude app (web or desktop)</div>
      <ol className={styles.steps}>
        <li>
          Open{' '}
          <a href="https://claude.ai/settings/connectors" target="_blank" rel="noopener noreferrer" className={styles.link}>
            Claude → Settings → Connectors ↗
          </a>
        </li>
        <li>Choose <strong>Add custom connector</strong>, name it <strong>Ecosystem</strong> and paste the URL above.</li>
        <li>
          Set <strong>Authentication</strong> to <strong>Sign in now</strong> and <strong>OAuth client</strong> to{' '}
          <strong>Register automatically</strong>. The default, &ldquo;Use Claude&apos;s published identity&rdquo;,
          won&apos;t work with Ecosystem. Leave request headers empty.
        </li>
        <li>Click <strong>Connect</strong>, sign in to Ecosystem if asked, then <strong>Allow</strong>.</li>
      </ol>

      <div className={styles.sectionTitle}>Claude Code</div>
      <CopyField value={`claude mcp add --transport http ecosystem ${mcpUrl}`} mono />
      <p className={styles.hint}>Then run <code>/mcp</code> in Claude Code to sign in.</p>
    </>
  )
}

function ChatGptSteps() {
  return (
    <>
      <div className={styles.sectionTitle}>ChatGPT (web or desktop)</div>
      <ol className={styles.steps}>
        <li>
          Open{' '}
          <a href="https://chatgpt.com/#settings/Connectors" target="_blank" rel="noopener noreferrer" className={styles.link}>
            ChatGPT → Settings → Apps &amp; Connectors ↗
          </a>
        </li>
        <li>
          Under <strong>Advanced settings</strong>, turn on <strong>Developer mode</strong>. It&apos;s what
          lets ChatGPT make changes for you, not just read.
        </li>
        <li>Choose <strong>Create</strong>, name it <strong>Ecosystem</strong>, paste the URL above and pick <strong>OAuth</strong> for authentication.</li>
        <li>Click <strong>Connect</strong>, sign in to Ecosystem if asked, then <strong>Allow</strong>.</li>
        <li>In a chat, turn on <strong>Ecosystem</strong> from the <strong>+</strong> menu before asking.</li>
      </ol>
      <p className={styles.hint}>
        Custom connectors need a paid ChatGPT plan. On a Business or Enterprise workspace, an admin may
        have to allow them first.
      </p>
    </>
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

/** A neutral spark mark — deliberately neither assistant's logo, which aren't ours to use. */
function SparkIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}
