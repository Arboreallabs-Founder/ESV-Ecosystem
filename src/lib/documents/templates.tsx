import { Text, View, StyleSheet } from '@react-pdf/renderer'
import { P, ORG } from './letterhead'
import { formatINR, amountInWords, formatLetterDate } from './engine'
import type { EmployeeProfile, EmployeeCompensation, EmploymentType } from '@/lib/types'
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/types'

/* Letter templates.

   Each returns a title and a body; the Letterhead component supplies everything around it — logo,
   reference number, signature block, footer, verification line. A template never renders those,
   so a change to the letterhead lands on every document at once.

   Templates read from `ctx`, which is a *snapshot* assembled at issue time and stored on the
   issued document. They must not reach for live data: a letter asserts facts as at its issue
   date, and re-deriving them would mean a letter sent last year silently changes when someone's
   designation does. */

const t = StyleSheet.create({
  table: { marginTop: 8, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#D3C1A9',
    paddingVertical: 4,
  },
  rowTotal: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#2C2C3A',
    paddingTop: 5,
    marginTop: 2,
  },
  cellLabel: { flex: 1, fontSize: 10 },
  cellValue: { width: 130, fontSize: 10, textAlign: 'right' },
  bold: { fontFamily: 'Times-Bold' },
  words: { fontSize: 9, fontStyle: 'italic', marginTop: 4, color: '#A39B95' },
  salutation: { marginBottom: 10 },
})

/** What an issuer has to type in, per document. */
export type DocFieldSpec = {
  name: string
  label: string
  type: 'text' | 'date' | 'textarea' | 'number'
  required?: boolean
  hint?: string
}

export type DocContext = {
  /** Display name, and the legal name when one is recorded — letters must match presented ID. */
  name: string
  legalName: string
  designation: string
  profile: EmployeeProfile | null
  compensation: EmployeeCompensation | null
  /** Issuer-supplied values, keyed by DocFieldSpec.name. */
  extras: Record<string, string>
  issueDate: string
}

export type DocTemplate = {
  title: string
  /** Profile fields without which the letter would state something false or blank. */
  requiresProfile?: Array<keyof EmployeeProfile>
  requiresCompensation?: boolean
  fields?: DocFieldSpec[]
  body: (ctx: DocContext) => React.ReactNode
}

// ── Shared fragments ────────────────────────────────────────────────────────

/** "Mr/Ms X, bearing employee code Y, has been employed with us since Z" — the spine of most letters. */
function employmentClause(ctx: DocContext): string {
  const p = ctx.profile
  const type = p?.employment_type
    ? EMPLOYMENT_TYPE_LABELS[p.employment_type as EmploymentType].toLowerCase()
    : 'employee'
  const since = p?.date_of_joining ? formatLetterDate(p.date_of_joining) : null
  const code = p?.employee_code ? ` (Employee Code: ${p.employee_code})` : ''
  return `${ctx.legalName}${code} is employed with ${ORG.legalName} as a ${type} in the capacity of ${ctx.designation}`
    + (since ? `, and has been with the organisation since ${since}.` : '.')
}

function ToWhom() {
  return <Text style={t.salutation}>To Whomsoever It May Concern,</Text>
}

function Addressed({ to }: { to?: string }) {
  if (!to?.trim()) return <ToWhom />
  return <Text style={t.salutation}>To,{'\n'}{to.trim()}</Text>
}

function AmountRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={bold ? t.rowTotal : t.row}>
      <Text style={[t.cellLabel, ...(bold ? [t.bold] : [])]}>{label}</Text>
      <Text style={[t.cellValue, ...(bold ? [t.bold] : [])]}>{formatINR(value)}</Text>
    </View>
  )
}

/** The CTC breakdown table, shared by the salary certificate and the CTC statement. */
function CompensationTable({ c }: { c: EmployeeCompensation }) {
  const lines: Array<[string, number | null]> = [
    ['Basic', c.basic], ['House Rent Allowance', c.hra], ['Special Allowance', c.special_allowance],
    ["Employer's Provident Fund", c.employer_pf], ['Gratuity', c.gratuity],
    ['Variable Pay', c.variable_pay], ['Other Allowances', c.other_allowances],
  ]
  const present = lines.filter(([, v]) => v != null) as Array<[string, number]>
  return (
    <View style={t.table}>
      {present.map(([label, value]) => <AmountRow key={label} label={label} value={value} />)}
      <AmountRow label="Total Annual Cost to Company" value={Number(c.annual_ctc)} bold />
      <Text style={t.words}>({amountInWords(Number(c.annual_ctc))})</Text>
    </View>
  )
}

// ── Registry ────────────────────────────────────────────────────────────────

export const TEMPLATES: Record<string, DocTemplate> = {

  // ── Employment verification ──
  employment_verification: {
    title: 'Employment Verification Letter',
    requiresProfile: ['date_of_joining'],
    fields: [{ name: 'addressed_to', label: 'Addressed to', type: 'text', hint: 'Leave blank for "To Whomsoever It May Concern"' }],
    body: (ctx) => (
      <>
        <Addressed to={ctx.extras.addressed_to} />
        <P>This is to certify that {employmentClause(ctx)}</P>
        <P>
          This letter has been issued at the request of the employee for the purpose of employment
          verification, and does not constitute a commitment of any kind on the part of the
          organisation.
        </P>
      </>
    ),
  },

  address_proof: {
    title: 'Address Proof',
    requiresProfile: ['date_of_joining', 'residential_address'],
    fields: [{ name: 'addressed_to', label: 'Addressed to', type: 'text', hint: 'Bank, landlord or authority' }],
    body: (ctx) => (
      <>
        <Addressed to={ctx.extras.addressed_to} />
        <P>This is to certify that {employmentClause(ctx)}</P>
        <P>
          As per our records, the residential address of the employee is:
          {'\n'}{ctx.profile?.residential_address}
        </P>
        <P>
          This letter is issued at the request of the employee for the purpose of address
          verification.
        </P>
      </>
    ),
  },

  bank_account_opening: {
    title: 'Bank Account Opening Letter',
    requiresProfile: ['date_of_joining'],
    fields: [
      { name: 'bank_name', label: 'Bank name', type: 'text', required: true },
      { name: 'branch', label: 'Branch', type: 'text' },
    ],
    body: (ctx) => (
      <>
        <Addressed to={[ctx.extras.bank_name, ctx.extras.branch].filter(Boolean).join('\n')} />
        <P>Dear Sir / Madam,</P>
        <P>This is to certify that {employmentClause(ctx)}</P>
        <P>
          We request you to kindly facilitate the opening of a savings account in the name of the
          employee. The organisation confirms the employment details stated above as accurate as at
          the date of this letter.
        </P>
      </>
    ),
  },

  visa_support: {
    title: 'Visa / Travel Support Letter',
    requiresProfile: ['date_of_joining'],
    fields: [
      { name: 'destination', label: 'Destination country', type: 'text', required: true },
      { name: 'purpose', label: 'Purpose of travel', type: 'text', required: true },
      { name: 'travel_from', label: 'Travel from', type: 'date' },
      { name: 'travel_to', label: 'Travel to', type: 'date' },
    ],
    body: (ctx) => {
      const from = ctx.extras.travel_from ? formatLetterDate(ctx.extras.travel_from) : null
      const to = ctx.extras.travel_to ? formatLetterDate(ctx.extras.travel_to) : null
      return (
        <>
          <Text style={t.salutation}>To,{'\n'}The Visa Officer{'\n'}Consulate of {ctx.extras.destination}</Text>
          <P>Dear Sir / Madam,</P>
          <P>This is to certify that {employmentClause(ctx)}</P>
          <P>
            The employee intends to travel to {ctx.extras.destination} for the purpose of{' '}
            {ctx.extras.purpose}
            {from && to ? `, from ${from} to ${to}` : ''}. The organisation has granted approval for
            this travel and confirms that the employee is expected to resume duties with us on
            return.
          </P>
          <P>
            We request you to kindly grant the necessary visa. All expenses in connection with the
            travel are as arranged between the employee and the organisation.
          </P>
        </>
      )
    },
  },

  noc_travel: {
    title: 'No Objection Certificate — Travel',
    requiresProfile: ['date_of_joining'],
    fields: [
      { name: 'destination', label: 'Destination', type: 'text', required: true },
      { name: 'travel_from', label: 'Travel from', type: 'date' },
      { name: 'travel_to', label: 'Travel to', type: 'date' },
    ],
    body: (ctx) => {
      const from = ctx.extras.travel_from ? formatLetterDate(ctx.extras.travel_from) : null
      const to = ctx.extras.travel_to ? formatLetterDate(ctx.extras.travel_to) : null
      return (
        <>
          <ToWhom />
          <P>This is to certify that {employmentClause(ctx)}</P>
          <P>
            The organisation has no objection to the employee travelling to {ctx.extras.destination}
            {from && to ? ` from ${from} to ${to}` : ''}. The employee&apos;s leave for this period has
            been duly approved.
          </P>
        </>
      )
    },
  },

  noc_study: {
    title: 'No Objection Certificate — Higher Study',
    requiresProfile: ['date_of_joining'],
    fields: [
      { name: 'institution', label: 'Institution', type: 'text', required: true },
      { name: 'course', label: 'Course / programme', type: 'text', required: true },
    ],
    body: (ctx) => (
      <>
        <ToWhom />
        <P>This is to certify that {employmentClause(ctx)}</P>
        <P>
          The organisation has no objection to the employee pursuing {ctx.extras.course} at{' '}
          {ctx.extras.institution}, provided that the said programme does not interfere with the
          employee&apos;s responsibilities and obligations to the organisation.
        </P>
      </>
    ),
  },

  // ── Leave & attendance ──
  leave_sanction: {
    title: 'Leave Sanction Letter',
    fields: [
      { name: 'leave_type', label: 'Leave type', type: 'text', required: true },
      { name: 'leave_from', label: 'From', type: 'date', required: true },
      { name: 'leave_to', label: 'To', type: 'date', required: true },
      { name: 'days', label: 'Number of days', type: 'number' },
    ],
    body: (ctx) => (
      <>
        <P>Dear {ctx.name},</P>
        <P>
          This is to confirm that your application for {ctx.extras.leave_type} from{' '}
          {formatLetterDate(ctx.extras.leave_from)} to {formatLetterDate(ctx.extras.leave_to)}
          {ctx.extras.days ? ` (${ctx.extras.days} day(s))` : ''} has been reviewed and sanctioned.
        </P>
        <P>
          Kindly ensure that pending responsibilities are handed over prior to the commencement of
          leave. We look forward to your return.
        </P>
      </>
    ),
  },

  wfh_approval: {
    title: 'Work From Home Approval',
    fields: [
      { name: 'wfh_from', label: 'From', type: 'date', required: true },
      { name: 'wfh_to', label: 'To', type: 'date', required: true },
      { name: 'reason', label: 'Reason', type: 'text' },
    ],
    body: (ctx) => (
      <>
        <P>Dear {ctx.name},</P>
        <P>
          This is to confirm that your request to work from home from{' '}
          {formatLetterDate(ctx.extras.wfh_from)} to {formatLetterDate(ctx.extras.wfh_to)} has been
          approved{ctx.extras.reason ? ` (${ctx.extras.reason})` : ''}.
        </P>
        <P>
          You are expected to remain available during standard working hours and to meet your
          usual responsibilities and deadlines through this period.
        </P>
      </>
    ),
  },

  comp_off: {
    title: 'Compensatory Off Confirmation',
    fields: [
      { name: 'worked_on', label: 'Worked on', type: 'date', required: true },
      { name: 'comp_off_on', label: 'Compensatory off granted for', type: 'date', required: true },
    ],
    body: (ctx) => (
      <>
        <P>Dear {ctx.name},</P>
        <P>
          In recognition of your having worked on {formatLetterDate(ctx.extras.worked_on)}, which
          was a designated non-working day, a compensatory off has been granted to you for{' '}
          {formatLetterDate(ctx.extras.comp_off_on)}.
        </P>
        <P>Thank you for your commitment and flexibility.</P>
      </>
    ),
  },

  // ── Compensation ──
  salary_certificate: {
    title: 'Salary Certificate',
    requiresProfile: ['date_of_joining'],
    requiresCompensation: true,
    fields: [{ name: 'addressed_to', label: 'Addressed to', type: 'text', hint: 'Bank or authority; blank for "To Whomsoever"' }],
    body: (ctx) => (
      <>
        <Addressed to={ctx.extras.addressed_to} />
        <P>This is to certify that {employmentClause(ctx)}</P>
        <P>
          The annual cost to company of the employee, with effect from{' '}
          {ctx.compensation ? formatLetterDate(ctx.compensation.effective_from) : ''}, is as follows:
        </P>
        {ctx.compensation && <CompensationTable c={ctx.compensation} />}
        <P>
          This certificate is issued at the request of the employee. The figures stated are gross
          and before applicable statutory deductions.
        </P>
      </>
    ),
  },

  ctc_breakdown: {
    title: 'Cost to Company Statement',
    requiresCompensation: true,
    body: (ctx) => (
      <>
        <P>Dear {ctx.name},</P>
        <P>
          Set out below is the break-up of your annual cost to company, effective{' '}
          {ctx.compensation ? formatLetterDate(ctx.compensation.effective_from) : ''}.
        </P>
        {ctx.compensation && <CompensationTable c={ctx.compensation} />}
        <P>
          All amounts are annual and gross of statutory deductions. Variable components, where
          applicable, are subject to the performance conditions communicated separately.
        </P>
      </>
    ),
  },

  increment_letter: {
    title: 'Increment Letter',
    requiresCompensation: true,
    fields: [
      { name: 'previous_ctc', label: 'Previous annual CTC (₹)', type: 'number' },
      { name: 'effective_from', label: 'Effective from', type: 'date', required: true },
    ],
    body: (ctx) => (
      <>
        <P>Dear {ctx.name},</P>
        <P>
          We are pleased to inform you that, in recognition of your contribution and performance,
          your compensation has been revised with effect from{' '}
          {formatLetterDate(ctx.extras.effective_from)}.
        </P>
        {ctx.extras.previous_ctc && (
          <P>Previous annual cost to company: {formatINR(Number(ctx.extras.previous_ctc))}</P>
        )}
        {ctx.compensation && <CompensationTable c={ctx.compensation} />}
        <P>
          All other terms and conditions of your employment remain unchanged. We thank you for your
          continued commitment.
        </P>
      </>
    ),
  },

  promotion_letter: {
    title: 'Promotion Letter',
    fields: [
      { name: 'new_designation', label: 'New designation', type: 'text', required: true },
      { name: 'effective_from', label: 'Effective from', type: 'date', required: true },
    ],
    body: (ctx) => (
      <>
        <P>Dear {ctx.name},</P>
        <P>
          We are pleased to inform you that you have been promoted to the position of{' '}
          {ctx.extras.new_designation}, with effect from{' '}
          {formatLetterDate(ctx.extras.effective_from)}.
        </P>
        <P>
          This promotion reflects the organisation&apos;s confidence in your abilities and the
          contribution you have made. All other terms and conditions of your employment remain
          unchanged unless communicated separately.
        </P>
        <P>Our congratulations and best wishes in your new role.</P>
      </>
    ),
  },

  bonus_letter: {
    title: 'Bonus Letter',
    fields: [
      { name: 'amount', label: 'Bonus amount (₹)', type: 'number', required: true },
      { name: 'period', label: 'In respect of', type: 'text', hint: 'e.g. FY 2025-26' },
    ],
    body: (ctx) => (
      <>
        <P>Dear {ctx.name},</P>
        <P>
          In recognition of your performance{ctx.extras.period ? ` in respect of ${ctx.extras.period}` : ''},
          the organisation is pleased to award you a bonus of{' '}
          {formatINR(Number(ctx.extras.amount || 0))} ({amountInWords(Number(ctx.extras.amount || 0))}).
        </P>
        <P>
          The amount is gross and subject to applicable statutory deductions, and will be paid with
          the next payroll cycle. This bonus is discretionary and does not form part of your
          contractual compensation.
        </P>
      </>
    ),
  },

  // ── Onboarding ──
  appointment_letter: {
    title: 'Appointment Letter',
    requiresProfile: ['date_of_joining'],
    fields: [{ name: 'reporting_to', label: 'Reporting to', type: 'text' }],
    body: (ctx) => (
      <>
        <P>Dear {ctx.legalName},</P>
        <P>
          Further to our discussions, we are pleased to confirm your appointment with{' '}
          {ORG.legalName} in the capacity of {ctx.designation}, with effect from{' '}
          {ctx.profile?.date_of_joining ? formatLetterDate(ctx.profile.date_of_joining) : ''}.
        </P>
        {ctx.extras.reporting_to && <P>You will report to {ctx.extras.reporting_to}.</P>}
        {ctx.profile?.probation_end_date && (
          <P>
            Your appointment is subject to a probationary period concluding on{' '}
            {formatLetterDate(ctx.profile.probation_end_date)}, during which your performance will
            be reviewed.
          </P>
        )}
        {ctx.profile?.notice_period_days != null && (
          <P>
            The notice period applicable to your employment is {ctx.profile.notice_period_days} days
            by either party.
          </P>
        )}
        <P>
          Your employment is governed by the organisation&apos;s policies as amended from time to
          time. We look forward to your association with us.
        </P>
      </>
    ),
  },

  probation_confirmation: {
    title: 'Confirmation of Employment',
    requiresProfile: ['date_of_joining'],
    body: (ctx) => (
      <>
        <P>Dear {ctx.name},</P>
        <P>
          We are pleased to inform you that, following a review of your performance during the
          probationary period, your employment with {ORG.legalName} has been confirmed
          {ctx.profile?.confirmation_date ? ` with effect from ${formatLetterDate(ctx.profile.confirmation_date)}` : ''}.
        </P>
        <P>
          You now hold the position of {ctx.designation} on a confirmed basis. All other terms of
          your employment remain unchanged.
        </P>
      </>
    ),
  },

  internship_offer: {
    title: 'Internship Offer Letter',
    fields: [
      { name: 'start_date', label: 'Start date', type: 'date', required: true },
      { name: 'end_date', label: 'End date', type: 'date', required: true },
      { name: 'stipend', label: 'Monthly stipend (₹)', type: 'number' },
    ],
    body: (ctx) => (
      <>
        <P>Dear {ctx.legalName},</P>
        <P>
          We are pleased to offer you an internship with {ORG.legalName} in the capacity of{' '}
          {ctx.designation}, commencing {formatLetterDate(ctx.extras.start_date)} and concluding{' '}
          {formatLetterDate(ctx.extras.end_date)}.
        </P>
        {ctx.extras.stipend && (
          <P>
            You will be paid a monthly stipend of {formatINR(Number(ctx.extras.stipend))}, subject to
            applicable statutory deductions.
          </P>
        )}
        <P>
          This internship does not constitute an offer of employment. You will be bound by the
          organisation&apos;s confidentiality obligations for the duration of the internship and
          thereafter.
        </P>
      </>
    ),
  },

  internship_completion: {
    title: 'Internship Completion Certificate',
    fields: [
      { name: 'start_date', label: 'Start date', type: 'date', required: true },
      { name: 'end_date', label: 'End date', type: 'date', required: true },
    ],
    body: (ctx) => (
      <>
        <ToWhom />
        <P>
          This is to certify that {ctx.legalName} has successfully completed an internship with{' '}
          {ORG.legalName} as a {ctx.designation}, from{' '}
          {formatLetterDate(ctx.extras.start_date)} to {formatLetterDate(ctx.extras.end_date)}.
        </P>
        <P>
          During the internship, we found them to be diligent and willing to learn. We wish them
          every success in their future endeavours.
        </P>
      </>
    ),
  },

  // ── Exit ──
  resignation_acceptance: {
    title: 'Acceptance of Resignation',
    fields: [
      { name: 'resigned_on', label: 'Resignation received on', type: 'date', required: true },
      { name: 'last_working_day', label: 'Last working day', type: 'date', required: true },
    ],
    body: (ctx) => (
      <>
        <P>Dear {ctx.name},</P>
        <P>
          We acknowledge receipt of your resignation dated{' '}
          {formatLetterDate(ctx.extras.resigned_on)}, and confirm its acceptance.
        </P>
        <P>
          Your last working day with {ORG.legalName} will be{' '}
          {formatLetterDate(ctx.extras.last_working_day)}. You are requested to complete the
          handover of your responsibilities and to settle any outstanding obligations prior to that
          date.
        </P>
        <P>We thank you for your contribution and wish you well.</P>
      </>
    ),
  },

  relieving_letter: {
    title: 'Relieving Letter',
    requiresProfile: ['date_of_joining', 'date_of_exit'],
    body: (ctx) => (
      <>
        <ToWhom />
        <P>
          This is to certify that {ctx.legalName}
          {ctx.profile?.employee_code ? ` (Employee Code: ${ctx.profile.employee_code})` : ''} was
          employed with {ORG.legalName} as {ctx.designation} from{' '}
          {ctx.profile?.date_of_joining ? formatLetterDate(ctx.profile.date_of_joining) : ''} to{' '}
          {ctx.profile?.date_of_exit ? formatLetterDate(ctx.profile.date_of_exit) : ''}.
        </P>
        <P>
          They have been relieved of their duties with effect from the close of business on{' '}
          {ctx.profile?.date_of_exit ? formatLetterDate(ctx.profile.date_of_exit) : ''}, and have
          completed the handover of responsibilities to the organisation&apos;s satisfaction.
        </P>
        <P>We wish them success in their future endeavours.</P>
      </>
    ),
  },

  experience_certificate: {
    title: 'Experience Certificate',
    requiresProfile: ['date_of_joining', 'date_of_exit'],
    body: (ctx) => (
      <>
        <ToWhom />
        <P>
          This is to certify that {ctx.legalName} served {ORG.legalName} as {ctx.designation} from{' '}
          {ctx.profile?.date_of_joining ? formatLetterDate(ctx.profile.date_of_joining) : ''} to{' '}
          {ctx.profile?.date_of_exit ? formatLetterDate(ctx.profile.date_of_exit) : ''}.
        </P>
        <P>
          Throughout their tenure we found them to be sincere, capable and professional in their
          conduct. Their contribution to the organisation is gratefully acknowledged.
        </P>
        <P>We wish them every success in their future career.</P>
      </>
    ),
  },

  no_dues: {
    title: 'No Dues Certificate',
    requiresProfile: ['date_of_exit'],
    body: (ctx) => (
      <>
        <ToWhom />
        <P>
          This is to certify that as at{' '}
          {ctx.profile?.date_of_exit ? formatLetterDate(ctx.profile.date_of_exit) : ctx.issueDate},{' '}
          {ctx.legalName}
          {ctx.profile?.employee_code ? ` (Employee Code: ${ctx.profile.employee_code})` : ''} has no
          outstanding dues payable to {ORG.legalName}.
        </P>
        <P>
          All organisational property, access credentials and records in their possession have been
          returned, and all accounts between the employee and the organisation stand settled.
        </P>
      </>
    ),
  },

  full_final_settlement: {
    title: 'Full and Final Settlement Statement',
    requiresProfile: ['date_of_exit'],
    fields: [
      { name: 'settlement_amount', label: 'Net settlement amount (₹)', type: 'number', required: true },
      { name: 'particulars', label: 'Particulars', type: 'textarea', hint: 'One line per item' },
    ],
    body: (ctx) => (
      <>
        <P>Dear {ctx.name},</P>
        <P>
          Further to the conclusion of your employment with {ORG.legalName} on{' '}
          {ctx.profile?.date_of_exit ? formatLetterDate(ctx.profile.date_of_exit) : ''}, we set out
          below the full and final settlement of your account.
        </P>
        {ctx.extras.particulars && <P>{ctx.extras.particulars}</P>}
        <View style={t.table}>
          <AmountRow label="Net amount payable" value={Number(ctx.extras.settlement_amount || 0)} bold />
          <Text style={t.words}>({amountInWords(Number(ctx.extras.settlement_amount || 0))})</Text>
        </View>
        <P>
          The above is gross of applicable statutory deductions and will be remitted to your
          registered bank account. This statement constitutes the full and final settlement of all
          claims between the parties.
        </P>
      </>
    ),
  },

  // ── Other ──
  testimonial: {
    title: 'Testimonial',
    fields: [
      { name: 'addressed_to', label: 'Addressed to', type: 'text' },
      { name: 'body', label: 'Testimonial text', type: 'textarea', required: true, hint: 'Free text — this is the letter.' },
    ],
    body: (ctx) => (
      <>
        <Addressed to={ctx.extras.addressed_to} />
        {/* Free text rather than a data merge, so the wording is the issuer's responsibility. */}
        {(ctx.extras.body ?? '').split(/\n{2,}/).filter(Boolean).map((para, i) => (
          <P key={i}>{para.trim()}</P>
        ))}
      </>
    ),
  },

  best_performer: {
    title: 'Certificate of Outstanding Performance',
    fields: [
      { name: 'period', label: 'Period', type: 'text', required: true, hint: 'e.g. Q2 FY 2026-27' },
      { name: 'citation', label: 'Citation', type: 'textarea', hint: 'Optional — what they are being recognised for' },
    ],
    body: (ctx) => (
      <>
        <P>This certificate is awarded to</P>
        <Text style={[t.bold, { fontSize: 18, textAlign: 'center', marginVertical: 12 }]}>
          {ctx.name}
        </Text>
        <P>
          in recognition of outstanding performance and contribution during {ctx.extras.period}.
        </P>
        {ctx.extras.citation && <P>{ctx.extras.citation}</P>}
        <P>
          {ORG.legalName} records its appreciation of the commitment, judgement and effort
          demonstrated, and offers its congratulations.
        </P>
      </>
    ),
  },
}

/** Whether a document type can actually be produced yet. */
export function hasTemplate(code: string): boolean {
  return code in TEMPLATES
}

/**
 * Data the letter needs but the profile doesn't have yet.
 * Checked before issuing — a letter with a blank joining date is worse than no letter.
 */
export function missingRequirements(
  code: string,
  profile: EmployeeProfile | null,
  compensation: EmployeeCompensation | null,
): string[] {
  const tpl = TEMPLATES[code]
  if (!tpl) return ['This document type has no template yet.']

  const missing: string[] = []
  for (const field of tpl.requiresProfile ?? []) {
    if (!profile?.[field]) missing.push(String(field).replace(/_/g, ' '))
  }
  if (tpl.requiresCompensation && !compensation) missing.push('a compensation record')
  return missing
}
