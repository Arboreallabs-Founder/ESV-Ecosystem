import SkeletonPage, { SkeletonStats, SkeletonTable } from '@/app/_components/Skeleton'

export default function EventKpiLoading() {
  return (
    <SkeletonPage>
      <>
      <SkeletonStats count={4} />
      <SkeletonTable rows={8} cols={5} />
    </>
    </SkeletonPage>
  )
}
