import SkeletonPage, { SkeletonRows } from '@/app/_components/Skeleton'

export default function FundraiseLoading() {
  return (
    <SkeletonPage>
      <SkeletonRows count={8} />
    </SkeletonPage>
  )
}
