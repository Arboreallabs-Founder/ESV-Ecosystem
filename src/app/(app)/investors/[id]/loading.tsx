import SkeletonPage, { SkeletonCards, SkeletonStats } from '@/app/_components/Skeleton'

export default function InvestorProfileLoading() {
  return (
    <SkeletonPage action>
      <>
      <SkeletonStats count={3} />
      <SkeletonCards count={4} minWidth={340} lines={3} chips={3} />
    </>
    </SkeletonPage>
  )
}
