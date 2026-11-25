/* Checks for the public website forms (/apply/syndicate, /apply/partner, /apply/intern; 20261126000000). The server
   repeats the ones that matter in submit_website_form. Returns the sentence to show, or null. */

export function websiteAnswerProblem(answer: string, node: { answer_type: string | null; contact_field: string | null }): string | null {
  const text = answer.trim()
  if (!text) return node.answer_type === 'mcq' ? 'Please choose an option to continue.' : 'Please answer this question to continue.'
  if (text.length > 5000) return 'Please keep your answer under 5,000 characters.'
  if (node.contact_field === 'email') {
    if (text.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) return 'Please enter a valid email address, such as name@example.com.'
  }
  if (node.contact_field === 'phone') {
    // International numbers of any length a phone network allows; never forced to 10 digits.
    const digits = text.replace(/\D/g, '')
    if (!/^[+\d\s().-]+$/.test(text) || digits.length < 8 || digits.length > 17) return 'Please enter a valid phone number, such as +91 98765 43210.'
    if (!text.startsWith('+') && !digits.startsWith('00') && digits.length <= 10) return 'Please include the country code, such as +91 or +971.'
  }
  return null
}
