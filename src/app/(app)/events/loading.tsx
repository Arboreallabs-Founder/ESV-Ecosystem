import SkeletonPage, { SkeletonCards } from '@/app/_components/Skeleton'

export default function EventsLoading() {
  return (
    <SkeletonPage action>
      <SkeletonCards count={6} minWidth={320} lines={2} chips={2} />
    </SkeletonPage>
  )
}
