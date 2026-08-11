import SkeletonPage, { SkeletonStats, SkeletonTable } from '@/app/_components/Skeleton'

export default function AnalyticsLoading() {
  return (
    <SkeletonPage>
      <>
      <SkeletonStats count={4} />
      <SkeletonTable rows={8} cols={6} />
    </>
    </SkeletonPage>
  )
}
