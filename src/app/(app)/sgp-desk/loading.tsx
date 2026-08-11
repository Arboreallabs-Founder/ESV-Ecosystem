import SkeletonPage, { SkeletonCards } from '@/app/_components/Skeleton'

export default function SgpDeskLoading() {
  return (
    <SkeletonPage>
      <SkeletonCards count={4} minWidth={340} lines={3} chips={2} />
    </SkeletonPage>
  )
}
