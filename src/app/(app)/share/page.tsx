import { redirect } from 'next/navigation'

/**
 * Share moved into /forms as a tab. This stays so links people already have — and anyone who
 * bookmarked the page while issuing links — land where the page went instead of on a 404.
 */
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>
}) {
  const { scope } = await searchParams
  redirect(scope === 'all' ? '/forms?tab=share&scope=all' : '/forms?tab=share')
}
