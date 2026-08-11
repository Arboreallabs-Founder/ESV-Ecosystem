import SkeletonPage, { SkeletonRows } from '@/app/_components/Skeleton'

export default function ApprovalsLoading() {
  return (
    <SkeletonPage>
      <SkeletonRows count={7} />
    </SkeletonPage>
  )
}
