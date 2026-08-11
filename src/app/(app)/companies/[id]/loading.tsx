import SkeletonPage, { SkeletonCards, SkeletonStats } from '@/app/_components/Skeleton'

export default function CompanyProfileLoading() {
  return (
    <SkeletonPage action>
      <>
      <SkeletonStats count={4} />
      <SkeletonCards count={4} minWidth={340} lines={3} chips={3} />
    </>
    </SkeletonPage>
  )
}
