import SkeletonPage, { SkeletonBoard } from '@/app/_components/Skeleton'

export default function FormBuilderLoading() {
  return (
    <SkeletonPage>
      <SkeletonBoard columns={3} perColumn={4} />
    </SkeletonPage>
  )
}
