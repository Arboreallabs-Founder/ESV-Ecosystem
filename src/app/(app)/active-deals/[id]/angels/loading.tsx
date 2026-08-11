import SkeletonPage, { SkeletonRows } from '@/app/_components/Skeleton'

export default function AngelsLoading() {
  return (
    <SkeletonPage action>
      <SkeletonRows count={8} />
    </SkeletonPage>
  )
}
