import SkeletonPage, { SkeletonRows } from '@/app/_components/Skeleton'

export default function ShareLoading() {
  return (
    <SkeletonPage>
      <SkeletonRows count={5} />
    </SkeletonPage>
  )
}
