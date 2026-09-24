// A small, dependency-free heuristic (not zxcvbn-level analysis) — good
// enough for a UX signal. The backend's own policy (server/utils/
// passwordPolicy.js) is the only real enforcement; this never blocks
// submission by itself.
const LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];

export function scorePasswordStrength(password) {
  if (!password) return { score: 0, label: LABELS[0] };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  return { score, label: LABELS[score] };
}
