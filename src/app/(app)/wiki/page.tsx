import { WIKI } from '@/lib/wiki'

export default async function WikiPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text)', marginBottom: '0.375rem' }}>
          Wiki & Help
        </h1>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9375rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
          Everything you need to know to use the Ecosystem platform effectively.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {Object.entries(WIKI).map(([key, section]) => (
            <div
              key={key}
              style={{
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.75rem',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.625rem', letterSpacing: '-0.01em' }}>
                {section.title}
              </h2>
              <p style={{ fontSize: '0.9375rem', color: 'var(--color-muted)', marginBottom: '1.5rem', lineHeight: 1.65 }}>
                {section.summary}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {section.items.map((item) => (
                  <div
                    key={item.heading}
                    style={{
                      padding: '0.875rem 1rem',
                      background: 'var(--color-bg)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.25rem' }}>
                      {item.heading}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', lineHeight: 1.6 }}>
                      {item.body}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
  )
}
