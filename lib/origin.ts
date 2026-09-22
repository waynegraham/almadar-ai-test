/** Next may normalize request.url to localhost; preserve the browser-facing host. */
export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || request.headers.get('host') || url.host;
  const forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  const protocol = forwarded === 'https' || forwarded === 'http' ? forwarded : url.protocol.replace(':','');
  return new URL(`${protocol}://${host}`).origin;
}
