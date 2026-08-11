import SkeletonPage, { SkeletonRows } from '@/app/_components/Skeleton'

export default function InvestorListsLoading() {
  return (
    <SkeletonPage>
      <SkeletonRows count={6} />
    </SkeletonPage>
  )
}
