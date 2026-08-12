'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createInvestor, updateInvestor } from '@/app/actions/investors'
import { SERVICE_TYPE_LABELS } from '@/lib/types'
import type { Investor, ServiceType } from '@/lib/types'
import { COUNTRY_OPTIONS } from '@/lib/countries'
import { STAGE_OPTIONS, SECTOR_OPTIONS, BUSINESS_TYPE_OPTIONS, THESIS_TAG_OPTIONS } from '@/lib/taxonomies'
import TagSelect from '@/app/_components/TagSelect'
import Combobox from '@/app/_components/Combobox'
import { parseBirthday, mdToDisplay, ageFrom } from '@/lib/birthday'
import {
  PersonIcon, PeopleIcon, TargetIcon, RupeeIcon, GlobeIcon, LinkIcon, CalendarIcon,
  ShieldIcon, CheckCircleIcon, BuildingIcon, BriefcaseIcon, TagIcon, HandshakeIcon, ChartIcon,
} from './InvestorFormIcons'
import styles from '../investors.module.css'

/** A titled card grouping related fields — the form's main unit of structure. */
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className={styles.formSection}>
      <div className={styles.formSectionHead}>
        <span className={styles.formSectionIcon}>{icon}</span>
        <span className={styles.formSectionTitle}>{title}</span>
      </div>
      {children}
    </div>
  )
}

/** Heading beside the control instead of above it, for sections holding a single field. */
function InlineSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className={`${styles.formSection} ${styles.formSectionInline}`}>
      <div className={styles.formSectionHead}>
        <span className={styles.formSectionIcon}>{icon}</span>
        <span className={styles.formSectionTitle}>{title}</span>
      </div>
      <div className={styles.formSectionField}>{children}</div>
    </div>
  )
}

/** Wraps a plain input/select to sit a leading icon inside it. */
function WithIcon({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className={styles.inputWrap}>
      <span className={styles.inputIcon}>{icon}</span>
      {children}
    </span>
  )
}

type ContactDraft = {
  key: string
  name: string
  role: string
  linkedin_url: string
  phone: string
  email: string
}

type Props = {
  mode: 'create' | 'edit'
  initial?: Investor
  internalUsers: Array<{ id: string; name: string }>
  franchisePartners: Array<{ id: string; name: string }>
  userRole: string
  onClose: () => void
  onSaved: () => void
}

function blankContact(): ContactDraft {
  return { key: crypto.randomUUID(), name: '', role: '', linkedin_url: '', phone: '', email: '' }
}

export default function InvestorFormModal({
  mode, initial, internalUsers, franchisePartners, userRole, onClose, onSaved,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(initial?.name ?? '')
  const [serviceType, setServiceType] = useState<ServiceType>(initial?.service_type ?? 'vc_fund')
  const [country, setCountry] = useState(initial?.country ?? (mode === 'create' ? 'India' : ''))
  const [website, setWebsite] = useState(initial?.website ?? '')
  const [stage, setStage] = useState(initial?.stage ?? '')
  const [esvPocs, setEsvPocs] = useState<string[]>(initial?.esv_pocs?.map((p) => p.id) ?? (initial?.esv_poc_id ? [initial.esv_poc_id] : []))
  const [pocSearch, setPocSearch] = useState('')
  const [pocDropdownOpen, setPocDropdownOpen] = useState(false)
  const pocInputRef = useRef<HTMLInputElement>(null)
  const [ticketMin, setTicketMin] = useState(initial?.ticket_size_min?.toString() ?? '')
  const [ticketMax, setTicketMax] = useState(initial?.ticket_size_max?.toString() ?? '')
  const [sectors, setSectors] = useState<string[]>(initial?.sectors ?? [])
  const [businessTypes, setBusinessTypes] = useState<string[]>(initial?.business_types ?? [])
  const [metaTags, setMetaTags] = useState<string[]>(initial?.meta_tags ?? [])
  const [referredBy, setReferredBy] = useState(initial?.referred_by_partner_id ?? '')
  const [onboardingDone, setOnboardingDone] = useState(initial?.onboarding_form_completed ?? false)
  const [onboardingUrl, setOnboardingUrl] = useState(initial?.onboarding_form_url ?? '')
  const [kycDone, setKycDone] = useState(initial?.kyc_done ?? false)
  const [birthday, setBirthday] = useState(mdToDisplay(initial?.birthday_md, initial?.birthday_year))
  const [contacts, setContacts] = useState<ContactDraft[]>(
    mode === 'create' ? [] : []  // contacts managed live in detail drawer on edit
  )

  // Live feedback on the birthday box: the field silently drops an unparseable entry, so say so
  // rather than letting someone hit Save believing it was recorded.
  const birthdayHint = (() => {
    if (!birthday.trim()) return null
    const { md, year } = parseBirthday(birthday)
    if (!md) return 'Not a valid date — use DD/MM or DD/MM/YYYY.'
    if (!year) return birthday.trim().split(/[/-]/).length > 2
      ? 'Year not recognised — saving the day and month only.'
      : null
    const age = ageFrom(md, year)
    return age === null ? null : `Turns ${age + 1} on their next birthday.`
  })()

  const stageList = stage ? stage.split(',').map((s) => s.trim()).filter(Boolean) : []
  const isPartner = userRole === 'franchise_partner'
  const canSetReferredBy = ['founder', 'admin'].includes(userRole)
  const showContacts = serviceType !== 'angel_investor'
  const showOnboardingKyc = serviceType === 'angel_investor' && !isPartner

  function setContact(key: string, field: keyof ContactDraft, val: string) {
    setContacts((cs) => cs.map((c) => c.key === key ? { ...c, [field]: val } : c))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    const contactDrafts = contacts
      .filter((c) => c.name.trim())
      .map((c, i) => ({
        name: c.name.trim(),
        role: c.role.trim() || null,
        linkedin_url: c.linkedin_url.trim() || null,
        linkedin_status: null,
        phone: c.phone.trim() || null,
        email: c.email.trim() || null,
        sort_order: i,
      }))

    // Parsed once here so both payloads agree, and so an unparseable entry clears both parts
    // together rather than leaving a stale year behind.
    const birthdayParts = parseBirthday(birthday)

    startTransition(async () => {
      if (mode === 'create') {
        await createInvestor({
          name: name.trim(),
          country: country.trim() || null,
          website: website.trim() || null,
          sectors,
          business_types: businessTypes,
          meta_tags: metaTags,
          service_type: serviceType,
          esv_poc_id: isPartner ? null : (esvPocs[0] ?? null),
          esv_poc_ids: isPartner ? [] : esvPocs,
          ticket_size_min: ticketMin ? Number(ticketMin) : null,
          ticket_size_max: ticketMax ? Number(ticketMax) : null,
          stage: stage.trim() || null,
          referred_by_partner_id: isPartner ? null : (referredBy || null),
          onboarding_form_completed: showOnboardingKyc ? onboardingDone : false,
          onboarding_form_url: showOnboardingKyc ? (onboardingUrl.trim() || null) : null,
          kyc_done: showOnboardingKyc ? kycDone : false,
          birthday_md: showOnboardingKyc ? birthdayParts.md : null,
          birthday_year: showOnboardingKyc ? birthdayParts.year : null,
          contacts: contactDrafts,
          isPartnerReferral: isPartner,
        })
      } else {
        await updateInvestor(initial!.id, {
          name: name.trim(),
          country: country.trim() || null,
          website: website.trim() || null,
          sectors,
          business_types: businessTypes,
          meta_tags: metaTags,
          service_type: serviceType,
          esv_poc_id: esvPocs[0] ?? null,
          esv_poc_ids: esvPocs,
          ticket_size_min: ticketMin ? Number(ticketMin) : null,
          ticket_size_max: ticketMax ? Number(ticketMax) : null,
          stage: stage.trim() || null,
          // No referred_by_partner_id. Changing who is credited is a claim on a fee, not a form
          // field — it goes through the SGP Desk, and the database refuses the direct write.
          onboarding_form_completed: showOnboardingKyc ? onboardingDone : false,
          onboarding_form_url: showOnboardingKyc ? (onboardingUrl.trim() || null) : null,
          kyc_done: showOnboardingKyc ? kycDone : false,
          birthday_md: showOnboardingKyc ? birthdayParts.md : null,
          birthday_year: showOnboardingKyc ? birthdayParts.year : null,
        })
      }
      router.refresh()
      onSaved()
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.formShell} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.formHeader}>
          <button type="button" className={styles.formBack} onClick={onClose} aria-label="Back">&#8592;</button>
          <div>
            <h2 className={styles.formTitle}>{mode === 'create' ? 'Add Investor' : 'Edit Investor'}</h2>
            <p className={styles.formSubtitle}>
              {mode === 'create'
                ? 'Add an investor to the database so the team can match them to deals.'
                : 'Update investor details to keep your database accurate.'}
            </p>
          </div>
          <span className={styles.formHeaderArt} aria-hidden="true"><PeopleIcon size={44} /></span>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <Section icon={<PersonIcon />} title="Basic Information">
            <div className={styles.formRow}>
              <div className={styles.field} style={{ flex: 2 }}>
                <label className={styles.label}>Name *</label>
                <WithIcon icon={<PersonIcon size={16} />}>
                  <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Fund or individual name" />
                </WithIcon>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Type *</label>
                <WithIcon icon={<BriefcaseIcon size={16} />}>
                  <select className={styles.select} value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceType)}>
                    {(Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </WithIcon>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.field}>
                <label className={styles.label}>Country</label>
                {/* Combobox renders its own flag chip, so no leading icon here. */}
                <Combobox options={COUNTRY_OPTIONS} value={country} onChange={setCountry} placeholder="Search country&#8230;" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Website</label>
                <WithIcon icon={<GlobeIcon size={16} />}>
                  <input className={styles.input} type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://&#8230;" />
                </WithIcon>
              </div>
            </div>
          </Section>

          <Section icon={<TargetIcon />} title="Investment Preferences &amp; Team">
            <div className={styles.formRow}>
              <div className={styles.field}>
                <label className={styles.label}>Stage Preference</label>
                <TagSelect
                  options={STAGE_OPTIONS}
                  value={stageList}
                  onChange={(vals) => setStage(vals.join(', '))}
                  placeholder="Select stages&#8230;"
                />
              </div>
              {!isPartner && (
                <div className={styles.field}>
                  <label className={styles.label}>ESV POC</label>
                  <div className={styles.pocSearchWrap} onClick={() => pocInputRef.current?.focus()}>
                    {esvPocs.map((id) => {
                      const user = internalUsers.find((u) => u.id === id)
                      if (!user) return null
                      return (
                        <span key={id} className={styles.pocSelectedChip}>
                          {user.name}
                          <button
                            type="button"
                            className={styles.pocSelectedChipRemove}
                            onMouseDown={(e) => { e.preventDefault(); setEsvPocs((prev) => prev.filter((x) => x !== id)) }}
                          >&times;</button>
                        </span>
                      )
                    })}
                    <input
                      ref={pocInputRef}
                      type="text"
                      className={styles.pocSearchInput}
                      placeholder={esvPocs.length === 0 ? 'Search team member\u2026' : ''}
                      value={pocSearch}
                      onChange={(e) => { setPocSearch(e.target.value); setPocDropdownOpen(true) }}
                      onFocus={() => setPocDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setPocDropdownOpen(false), 150)}
                    />
                    {pocDropdownOpen && (
                      <div className={styles.pocDropdown}>
                        {internalUsers
                          .filter((u) => !esvPocs.includes(u.id) && u.name.toLowerCase().includes(pocSearch.toLowerCase()))
                          .map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              className={styles.pocDropdownItem}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setEsvPocs((prev) => [...prev, u.id])
                                setPocSearch('')
                                setPocDropdownOpen(false)
                              }}
                            >
                              {u.name}
                            </button>
                          ))
                        }
                        {internalUsers.filter((u) => !esvPocs.includes(u.id) && u.name.toLowerCase().includes(pocSearch.toLowerCase())).length === 0 && (
                          <div className={styles.pocDropdownEmpty}>No matches</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Section>

          <Section icon={<RupeeIcon />} title="Investment Range (&#8377;)">
            <div className={styles.formRow}>
              <div className={styles.field}>
                <label className={styles.label}>Ticket Min (&#8377;)</label>
                <WithIcon icon={<RupeeIcon size={16} />}>
                  <input className={styles.input} type="number" min={0} step={100000} value={ticketMin} onChange={(e) => setTicketMin(e.target.value)} placeholder="e.g. 500000" />
                </WithIcon>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Ticket Max (&#8377;)</label>
                <WithIcon icon={<ChartIcon size={16} />}>
                  <input className={styles.input} type="number" min={0} step={5000000} value={ticketMax} onChange={(e) => setTicketMax(e.target.value)} placeholder="e.g. 50000000" />
                </WithIcon>
              </div>
            </div>
          </Section>

          {/* Onboarding + KYC — angel investors only */}
          {showOnboardingKyc && (
            <Section icon={<ShieldIcon />} title="Onboarding &amp; KYC">
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Onboarding Form Completed</label>
                  <WithIcon icon={<CheckCircleIcon size={16} />}>
                    <select className={styles.select} value={onboardingDone ? 'yes' : 'no'} onChange={(e) => setOnboardingDone(e.target.value === 'yes')}>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </WithIcon>
                </div>
                <div className={styles.field}>
                  {/* The year is optional on purpose — for most angels it simply isn't known,
                      and day/month alone is enough to wish them a happy birthday. */}
                  <label className={styles.label}>Birthday (DD/MM, year optional)</label>
                  <WithIcon icon={<CalendarIcon size={16} />}>
                    <input
                      className={styles.input}
                      type="text"
                      inputMode="numeric"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      placeholder="e.g. 29/07 or 29/07/1984"
                      title="Day and month, with an optional year — e.g. 29/07 or 29/07/1984"
                    />
                  </WithIcon>
                  {birthdayHint && <span className={styles.fieldHint}>{birthdayHint}</span>}
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label className={styles.label}>KYC Done</label>
                  <WithIcon icon={<ShieldIcon size={16} />}>
                    <select className={styles.select} value={kycDone ? 'yes' : 'no'} onChange={(e) => setKycDone(e.target.value === 'yes')}>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </WithIcon>
                </div>
                <div className={styles.field} style={{ flex: 2 }}>
                  <label className={styles.label}>Signed Onboarding Form Link</label>
                  <WithIcon icon={<LinkIcon size={16} />}>
                    <input className={styles.input} type="url" value={onboardingUrl} onChange={(e) => setOnboardingUrl(e.target.value)} placeholder="https://&#8230;" />
                  </WithIcon>
                </div>
              </div>
            </Section>
          )}

          <InlineSection icon={<BuildingIcon />} title="Sectors">
            {/* Pick-only. Free text is how "Fintech", "FinTech" and "Health tech" all came to exist,
                  and nothing matched across them. */}
            <TagSelect options={SECTOR_OPTIONS} value={sectors} onChange={setSectors} placeholder="Search sectors&#8230;" allowCustom={false} />
          </InlineSection>

          <div className={`${styles.formSection} ${styles.formInlinePair}`}>
            <div className={styles.formSectionInline}>
              <div className={styles.formSectionHead}>
                <span className={styles.formSectionIcon}><BriefcaseIcon /></span>
                <span className={styles.formSectionTitle}>Business Types</span>
              </div>
              <div className={styles.formSectionField}>
                <TagSelect options={BUSINESS_TYPE_OPTIONS} value={businessTypes} onChange={setBusinessTypes} placeholder="Search business types&#8230;" />
              </div>
            </div>
            <div className={styles.formSectionInline}>
              <div className={styles.formSectionHead}>
                <span className={styles.formSectionIcon}><TagIcon /></span>
                <span className={styles.formSectionTitle}>Other Thesis Tags</span>
              </div>
              <div className={styles.formSectionField}>
                <TagSelect options={THESIS_TAG_OPTIONS} value={metaTags} onChange={setMetaTags} placeholder="Search thesis tags&#8230;" />
              </div>
            </div>
          </div>

          {/* Referred By — admin/founder only, and only when creating.
              On create this files an attribution claim rather than crediting anyone: the fund is
              saved either way, the credit waits for a coordinator and the founder. On edit it is
              not offered at all, because a control that silently does nothing is worse than no
              control — changing an existing attribution goes through the SGP Desk. */}
          {canSetReferredBy && mode === 'create' && (
            <InlineSection icon={<HandshakeIcon />} title="Referred By Partner">
              <Combobox
                options={franchisePartners.map((p) => ({ id: p.id, label: p.name }))}
                value={referredBy}
                onChange={setReferredBy}
                placeholder="Search a partner&#8230;"
              />
              <p className={styles.formHint}>
                Files a claim for approval. The partner is credited once a coordinator and the
                founder have both signed it off on the SGP Desk.
              </p>
            </InlineSection>
          )}

          {/* Contacts — create mode only, not angel_investor */}
          {mode === 'create' && showContacts && (
            <Section icon={<PeopleIcon />} title="Contacts">
              <div className={styles.contactsSection} style={{ marginTop: 0 }}>
                <div className={styles.contactsSectionTitle}>
                  <span style={{ color: 'var(--color-muted)', fontSize: '0.8125rem', fontWeight: 500 }}>
                    People to reach at this investor
                  </span>
                  <button type="button" className={styles.addContactInlineBtn}
                    onClick={() => setContacts((cs) => [...cs, blankContact()])}>
                    + Add
                  </button>
                </div>
                {contacts.map((c) => (
                  <div key={c.key} className={styles.contactDraftRow}>
                    <input className={styles.input} placeholder="Name *" value={c.name}
                      onChange={(e) => setContact(c.key, 'name', e.target.value)} />
                    <input className={styles.input} placeholder="Role" value={c.role}
                      onChange={(e) => setContact(c.key, 'role', e.target.value)} />
                    <input className={styles.input} placeholder="Email *" type="email" value={c.email}
                      onChange={(e) => setContact(c.key, 'email', e.target.value)} />
                    <input className={styles.input} placeholder="LinkedIn URL" type="url" value={c.linkedin_url}
                      onChange={(e) => setContact(c.key, 'linkedin_url', e.target.value)} />
                    <input className={styles.input} placeholder="Phone" value={c.phone}
                      onChange={(e) => setContact(c.key, 'phone', e.target.value)} />
                    <button type="button" className={styles.contactDraftRemove}
                      onClick={() => setContacts((cs) => cs.filter((x) => x.key !== c.key))}>&times;</button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <div className={styles.formFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.formSaveBtn} disabled={isPending || !name.trim()}>
              <SaveIcon />
              {isPending ? 'Saving\u2026' : mode === 'create' ? 'Add Investor' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SaveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3h11l3 3v15H5zM8 3v6h8V3M8 21v-6h8v6" />
    </svg>
  )
}
