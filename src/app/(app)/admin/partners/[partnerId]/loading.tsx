import SkeletonPage, { SkeletonStats, SkeletonTable } from '@/app/_components/Skeleton'

export default function PartnerDetailLoading() {
  return (
    <SkeletonPage>
      <>
      <SkeletonStats count={3} />
      <SkeletonTable rows={6} cols={5} />
    </>
    </SkeletonPage>
  )
}
