import SkeletonPage, { SkeletonCards } from '@/app/_components/Skeleton'

export default function EngageLoading() {
  return (
    <SkeletonPage action>
      <SkeletonCards count={6} minWidth={280} lines={2} chips={0} />
    </SkeletonPage>
  )
}
