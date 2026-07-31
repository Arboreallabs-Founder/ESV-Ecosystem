import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import type { SignatureMode } from '@/lib/types'

/* The ESV letterhead, as a react-pdf component.

   Values are transcribed from ESV Letterhead-Updated.docx and are the registered entity's, so
   they are constants rather than configuration — getting them from a database would invite them
   being wrong on a legal document.

   Typeface: the .docx is set in Book Antiqua, a licensed Monotype face. Embedding it into PDFs
   distributed to banks and consulates is a licensing question nobody has answered, so this uses
   react-pdf's built-in Times-Roman — visually close, legally uncomplicated. See
   docs/DOCUMENTS_BUILD_PLAN.md. */

export const ORG = {
  legalName: 'Earlyseed Ventures Private Limited',
  address: '3 Enterprise Centre, Near Orchid Hotel, Off. Nehru Road, Navpada, Vile Parle East, Mumbai 400 099, India.',
  email: 'info@earlyseedventures.com',
  website: 'www.earlyseedventures.com',
  phone: '+91 22 45133786',
  cin: 'U74999MH2023PTC397996',
} as const

// Brand tokens, from ESV Color Palette.jpeg. Printed documents stay near-monochrome — colour is
// used for the rule under the wordmark and nothing else.
const COLOR = {
  ink: '#2C2C3A',
  muted: '#A39B95',
  sand: '#D3C1A9',
  bronze: '#D5AE8F',
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingBottom: 92, // room for the fixed footer
    paddingHorizontal: 56,
    fontFamily: 'Times-Roman',
    fontSize: 10.5,
    lineHeight: 1.55,
    color: COLOR.ink,
  },
  wordmark: { width: 132, marginBottom: 6 },
  headRule: { borderBottomWidth: 1, borderBottomColor: COLOR.sand, marginBottom: 22 },

  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  metaText: { fontSize: 9, color: COLOR.muted },

  title: {
    fontFamily: 'Times-Bold',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 18,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },

  body: { marginBottom: 14 },
  paragraph: { marginBottom: 10, textAlign: 'justify' },

  signBlock: { marginTop: 34 },
  signImage: { width: 132, height: 44, marginBottom: 4, objectFit: 'contain' },
  signLine: { width: 180, borderBottomWidth: 0.75, borderBottomColor: COLOR.ink, marginBottom: 4, marginTop: 34 },
  signName: { fontFamily: 'Times-Bold', fontSize: 10.5 },
  signRole: { fontSize: 9, color: COLOR.muted },
  signNote: { fontSize: 8, color: COLOR.muted, marginTop: 8, fontStyle: 'italic' },

  footer: {
    position: 'absolute',
    bottom: 28,
    left: 56,
    right: 56,
    textAlign: 'center',
    fontSize: 7.5,
    color: COLOR.muted,
    lineHeight: 1.45,
  },
  footerRule: { borderTopWidth: 1, borderTopColor: COLOR.sand, marginBottom: 6 },
  verify: { fontSize: 7.5, color: COLOR.ink, marginTop: 3 },
})

export type LetterheadProps = {
  /** Printed top-left, e.g. ESV/2026/EVL/0042. */
  humanId: string
  /** Long-form issue date, already formatted. */
  issueDate: string
  title: string
  signatureMode: SignatureMode
  signatoryName: string
  signatoryDesignation: string
  /** Public verification URL, printed in the footer. */
  verifyUrl: string
  /** Data URI of the signature image; only used when signatureMode is 'visual'. */
  signatureImage?: string | null
  children: React.ReactNode
}

/** A paragraph of letter body text. Templates compose these. */
export function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>
}

export function Letterhead({
  humanId, issueDate, title, signatureMode, signatoryName, signatoryDesignation,
  verifyUrl, signatureImage, children,
}: LetterheadProps) {
  return (
    <Document title={`${title} — ${humanId}`} author={ORG.legalName}>
      <Page size="A4" style={styles.page}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image takes no alt */}
        <Image style={styles.wordmark} src="public/brand/esv-letterhead-wordmark.png" />
        <View style={styles.headRule} />

        <View style={styles.meta}>
          <Text style={styles.metaText}>Ref: {humanId}</Text>
          <Text style={styles.metaText}>{issueDate}</Text>
        </View>

        <Text style={styles.title}>{title}</Text>

        <View style={styles.body}>{children}</View>

        <View style={styles.signBlock}>
          {/* A rendered signature image is a picture of a name, not a digital signature — the
              distinction is documented in docs/DOCUMENTS.md and stated on the page below. */}
          {signatureMode === 'visual' && signatureImage && (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={styles.signImage} src={signatureImage} />
          )}
          {signatureMode === 'physical' && <View style={styles.signLine} />}

          <Text style={styles.signName}>{signatoryName}</Text>
          <Text style={styles.signRole}>{signatoryDesignation}</Text>
          <Text style={styles.signRole}>{ORG.legalName}</Text>

          {signatureMode === 'system' && (
            <Text style={styles.signNote}>
              This is a system-generated document and does not require a signature.
            </Text>
          )}
          {signatureMode === 'physical' && (
            <Text style={styles.signNote}>
              This document is valid only when signed above by an authorised signatory.
            </Text>
          )}
        </View>

        <View style={styles.footer} fixed>
          <View style={styles.footerRule} />
          <Text>{ORG.legalName}</Text>
          <Text>{ORG.address}</Text>
          <Text>{ORG.email} | {ORG.website}</Text>
          <Text>T: {ORG.phone} | CIN No.: {ORG.cin}</Text>
          <Text style={styles.verify}>Verify this document at {verifyUrl}</Text>
        </View>
      </Page>
    </Document>
  )
}
