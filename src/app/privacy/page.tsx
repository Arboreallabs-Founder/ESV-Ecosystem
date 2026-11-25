import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { getUser } from '@/lib/user'
import { ORG } from '@/lib/documents/org'
import styles from './privacy.module.css'

/*
 * The privacy policy: linked from the login page and the website forms' consent question.
 *
 * DRAFT until a founder approves it. While APPROVED is false only signed-in team members can open
 * it (a public draft would read as the real policy), and the website forms stay unpublished
 * (20261126000000). Going live: settle every <Confirm>, set EFFECTIVE and APPROVED, deploy, then
 * publish the forms.
 */
const APPROVED = false
const EFFECTIVE = ''

export const metadata: Metadata = { title: 'Privacy policy | Earlyseed Ventures', robots: APPROVED ? undefined : { index: false } }

/** Something ESV has to decide or check before this goes live. */
function Confirm({ children }: { children: ReactNode }) {
  return <mark className={styles.confirm}>{children}</mark>
}

const SECTIONS: Array<{ id: string; title: string; body: ReactNode }> = [
  { id: 'who', title: 'Who we are', body: (
    <p>
      This policy is from {ORG.legalName} (&ldquo;Earlyseed Ventures&rdquo;, &ldquo;we&rdquo;), {ORG.address} CIN {ORG.cin}.
      It covers the application forms linked from {ORG.website}, and Ecosystem, the system we use to manage our work.
    </p>
  ) },
  { id: 'collect', title: 'What we collect', body: (
    <>
      <p>Only what you give us, and what we need to run the service:</p>
      <ul>
        <li><b>Syndicate applications:</b> your name, email, phone number, city and country, LinkedIn profile, occupation, how you would invest, past investments you choose to share, and your preferences.</li>
        <li><b>Strategic Growth Partner applications:</b> your name, email, phone number, city and country, LinkedIn profile, role, background, network, experience and other roles you hold.</li>
        <li><b>Start-up applications:</b> your name and contact details, and the information you share about your company.</li>
        <li><b>Accounts:</b> if we give you access to Ecosystem, your name, email address and profile photo, from your Google account if you sign in with Google, and a record of your activity.</li>
        <li><b>The person who referred you,</b> if you name them. Please only name someone who would not mind.</li>
      </ul>
      <p>
        Our application forms do not ask for PAN, Aadhaar, passport, bank or demat details, or for documents. If we need identity
        checks later, we ask for them separately.
      </p>
    </>
  ) },
  { id: 'use', title: 'Why we use it', body: (
    <>
      <p>With your consent, we use your details to:</p>
      <ul>
        <li>read and respond to your application, and contact you about what you applied for</li>
        <li>keep a record of our conversations with you</li>
        <li>meet our legal and regulatory obligations</li>
      </ul>
      <p>
        Applying to one programme is not consent to be contacted about another. We do not use your details for advertising, and
        no decision about your application is made by software alone.
      </p>
    </>
  ) },
  { id: 'share', title: 'Who sees it', body: (
    <>
      <p>We do not sell your details. They are seen by:</p>
      <ul>
        <li><b>Our team,</b> who can see applications in Ecosystem.</li>
        <li><b>Companies that run our systems for us:</b> Supabase (database and sign-in), Vercel (hosting) and Google (sign-in).</li>
        <li><b>AI assistants our team uses.</b> Team members can connect Claude (Anthropic) or ChatGPT (OpenAI) to Ecosystem. If they ask one about an application, it processes that information to answer.</li>
        <li><b>Authorities,</b> where the law requires it.</li>
      </ul>
      <p><Confirm>Confirm: we ask you before sharing your application with a start-up, investor or partner.</Confirm></p>
    </>
  ) },
  { id: 'where', title: 'Where it is kept, and how', body: (
    <p>
      Our database is in Mumbai, India. Some of the companies above may process information outside India. Connections to our
      systems are encrypted, access needs a sign-in we have approved, and what each person can see depends on their role.
    </p>
  ) },
  { id: 'long', title: 'How long we keep it', body: (
    <p>
      <Confirm>Confirm the period. Suggested: applications that do not go ahead are deleted 24 months after our last contact with you; records of members, partners and clients are kept for as long as we work together, and then as long as the law requires.</Confirm>
    </p>
  ) },
  { id: 'rights', title: 'Your choices', body: (
    <>
      <p>You can ask us to:</p>
      <ul>
        <li>tell you what we hold about you and who we have shared it with</li>
        <li>correct or complete it</li>
        <li>delete it, unless the law requires us to keep it</li>
        <li>stop using it: you can withdraw your consent at any time, as easily as you gave it</li>
        <li>record someone to act for you if you die or cannot act yourself</li>
      </ul>
      <p>
        Email <a href={`mailto:${ORG.email}`}>{ORG.email}</a>. We may check that it is you first. Withdrawing consent does not
        affect what was done before, and may mean we cannot continue with your application.
      </p>
    </>
  ) },
  { id: 'cookies', title: 'Cookies', body: (
    <p>
      The application forms do not use advertising or analytics cookies. Ecosystem uses cookies to keep people signed in, and
      your browser remembers your choice of theme.
    </p>
  ) },
  { id: 'children', title: 'Under 18s', body: (
    <p>Our forms are for adults. If you think someone under 18 has sent us their details, tell us and we will delete them.</p>
  ) },
  { id: 'contact', title: 'Questions and complaints', body: (
    <>
      <p>
        Contact our Grievance Officer, <Confirm>name to be confirmed</Confirm>, at <a href={`mailto:${ORG.email}`}>{ORG.email}</a>,{' '}
        {ORG.phone}, or the address above. We reply within <Confirm>30 days (confirm)</Confirm>. If you are not satisfied, you can
        complain to the Data Protection Board of India.
      </p>
      <p>If we change this policy we will update the date on this page, and ask for your consent again where the law requires it.</p>
    </>
  ) },
]

export default async function PrivacyPage() {
  if (!APPROVED) {
    const user = await getUser()
    if (!user || user.role === 'franchise_partner') notFound()
  }

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static, already-small asset */}
        <img src="/brand/esv-logo.png" alt="Earlyseed Ventures" className={styles.logo} />
        <h1 className={styles.title}>Privacy policy</h1>
        <p className={styles.date}>{EFFECTIVE ? `Effective ${EFFECTIVE}` : 'Draft, not in effect'}</p>
        {!APPROVED && (
          <p className={styles.draft}>
            <b>Draft for approval.</b> Only the team can see this page. Highlighted points need a decision, and a lawyer should
            review the wording before it goes live.
          </p>
        )}
      </header>
      <div className={styles.sections}>
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className={styles.section}>
            <h2 className={styles.heading}>{s.title}</h2>
            <div className={styles.prose}>{s.body}</div>
          </section>
        ))}
      </div>
    </main>
  )
}
