/** Use the registered domain, preserving a dev server port only for localhost. */
export function tenantLoginUrl(domain, location = window.location) {
  if (!domain || !/^[a-z0-9.-]+$/i.test(domain) || domain.includes('..')) {
    throw new Error("Tenant domeni noto'g'ri");
  }
  const local = domain === 'localhost' || domain.endsWith('.localhost');
  const port = local && location.port ? `:${location.port}` : '';
  return `${local ? 'http:' : 'https:'}//${domain}${port}/login`;
}
