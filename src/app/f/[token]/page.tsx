import { renderPublicForm } from './render-public-form'

export default async function PublicFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return renderPublicForm(token)
}
