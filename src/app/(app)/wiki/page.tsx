import WikiClient from './_components/WikiClient'

/**
 * The full wiki.
 *
 * Client-rendered because the two things that make thirty sections usable — search and knowing
 * where you are in them — are both interactions. The content itself is a static module, so there
 * is no data fetch to lose by doing it here.
 */
export default async function WikiPage() {
  return <WikiClient />
}
