import SkeletonPage, { SkeletonTable } from '@/app/_components/Skeleton'

export default function ActivityLogLoading() {
  return (
    <SkeletonPage>
      <SkeletonTable rows={12} cols={4} />
    </SkeletonPage>
  )
}
