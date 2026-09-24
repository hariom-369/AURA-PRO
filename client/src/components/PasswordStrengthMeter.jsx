import { scorePasswordStrength } from '../utils/passwordStrength';

const SEGMENT_COLORS = ['bg-rose-500', 'bg-rose-400', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500', 'bg-emerald-600'];

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null;
  const { score, label } = scorePasswordStrength(password);

  return (
    <div className="mt-1.5">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i < score ? SEGMENT_COLORS[score] : 'bg-zinc-200 dark:bg-zinc-700'}`}
          />
        ))}
      </div>
      <p role="status" aria-live="polite" className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Password strength: {label}
      </p>
    </div>
  );
}
