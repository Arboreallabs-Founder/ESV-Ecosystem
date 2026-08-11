import SkeletonPage, { SkeletonStats, SkeletonTable } from '@/app/_components/Skeleton'

export default function AttendanceLoading() {
  return (
    <SkeletonPage>
      <>
      <SkeletonStats count={3} />
      <SkeletonTable rows={10} cols={5} />
    </>
    </SkeletonPage>
  )
}
