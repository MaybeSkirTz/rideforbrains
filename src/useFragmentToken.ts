import { useEffect, useState } from 'react';

// Opening a second email link may change only the fragment in the same tab.
export default function useFragmentToken() {
  const [token, setToken] = useState(() => location.hash.slice(1));
  useEffect(() => {
    const update = () => setToken(location.hash.slice(1));
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return token;
}
