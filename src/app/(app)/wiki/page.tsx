import { WIKI } from '@/lib/wiki'
import styles from './wiki.module.css'

export default async function WikiPage() {
  const sections = Object.entries(WIKI)

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Wiki &amp; Help</h1>
        <p className={styles.subtitle}>
          Every screen in Ecosystem, what it is for, and the decisions baked into it. The same text
          is behind the <strong>?</strong> button on each page — this is all of it in one place.
        </p>
      </div>

      <div className={styles.layout}>
        {/* Thirty sections is too many to scroll through hoping. */}
        <nav className={styles.index} aria-label="Wiki contents">
          <div className={styles.indexLabel}>Contents</div>
          {sections.map(([key, section]) => (
            <a key={key} href={`#${key}`} className={styles.indexLink}>
              {section.title}
            </a>
          ))}
        </nav>

        <div className={styles.sections}>
          {sections.map(([key, section]) => (
            <section key={key} id={key} className={styles.section}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              <p className={styles.sectionSummary}>{section.summary}</p>
              <div className={styles.items}>
                {section.items.map((item) => (
                  <div key={item.heading} className={styles.item}>
                    <div className={styles.itemHeading}>{item.heading}</div>
                    <div className={styles.itemBody}>{item.body}</div>
                    {/* A sketch of the real screen. Half of what people get stuck on is not what a
                        thing does, but where it is and what it looks like when it is working. */}
                    {item.snippet && <pre className={styles.snippet}>{item.snippet}</pre>}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
