/**
 * Mock signup endpoint. In production this would be `POST /api/signup`.
 * Resolves after a short delay; never rejects in this mock — but the calling
 * hook still wraps it in try/catch so a future real implementation can throw.
 */
export async function submitSignup(email: string, password: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  // eslint-disable-next-line no-console
  console.log('Form submitted:', { email, password });
}
