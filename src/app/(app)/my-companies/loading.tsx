import SkeletonPage, { SkeletonCards } from '@/app/_components/Skeleton'

export default function MyCompaniesLoading() {
  return (
    <SkeletonPage action>
      <SkeletonCards count={6} minWidth={340} lines={2} chips={4} />
    </SkeletonPage>
  )
}
