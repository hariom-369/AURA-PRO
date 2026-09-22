import { useNavigate } from 'react-router-dom';
import { useCompare } from '../context/CompareContext';

export default function CompareBar() {
  const { ids, clearCompare } = useCompare();
  const navigate = useNavigate();

  if (ids.length < 2) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-full border border-zinc-200 bg-white px-5 py-2.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{ids.length} selected to compare</span>
      <button
        onClick={() => navigate('/compare')}
        className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-brand-700"
      >
        Compare
      </button>
      <button onClick={clearCompare} className="text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
        Clear
      </button>
    </div>
  );
}
