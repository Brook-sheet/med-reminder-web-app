const PH_MOBILE_PATTERN =
  /^\+639\d{9}$/;

export function normalizePhilippineMobileNumber(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const compact = value
    .trim()
    .replace(/[\s().-]/g, '');

  let normalized = compact;

  if (/^09\d{9}$/.test(compact)) {
    normalized =
      `+63${compact.slice(1)}`;
  } else if (/^9\d{9}$/.test(compact)) {
    normalized =
      `+63${compact}`;
  } else if (
    /^639\d{9}$/.test(compact)
  ) {
    normalized =
      `+${compact}`;
  }

  return PH_MOBILE_PATTERN.test(
    normalized
  )
    ? normalized
    : null;
}

export function maskPhilippineMobileNumber(
  value: unknown
): string {
  const normalized =
    normalizePhilippineMobileNumber(
      value
    );

  if (!normalized) {
    return '';
  }

  return `${normalized.slice(
    0,
    3
  )} ${normalized.slice(
    3,
    6
  )} *** ${normalized.slice(-4)}`;
}