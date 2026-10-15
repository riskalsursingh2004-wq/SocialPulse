import { LoaderCircle } from 'lucide-react';

/** Small inline spinner used by refresh / import actions. */
export default function Spinner({ size = 16, className = '' }) {
  return <LoaderCircle size={size} className={`animate-spin ${className}`} aria-hidden="true" />;
}
