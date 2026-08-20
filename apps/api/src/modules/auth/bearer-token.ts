export function extractBearerToken(
  authorization: string | string[] | undefined,
): string | null {
  if (typeof authorization !== "string") {
    return null;
  }

  const match = /^Bearer[\t ]+([^\s,]+)$/i.exec(authorization);

  return match?.[1] ?? null;
}
