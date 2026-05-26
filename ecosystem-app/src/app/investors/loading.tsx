import LoadingShell from '@/app/_components/LoadingShell'

export default function InvestorsLoading() {
  return (
    <LoadingShell>
      <div className="skeleton" style={{ height: 320, borderRadius: 10 }} />
    </LoadingShell>
  )
}
