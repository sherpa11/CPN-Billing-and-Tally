import { useState, useEffect } from 'react';

/**
 * useDebounce hook delays updating the returned value until the specified delay has passed.
 * Used for search inputs to prevent firing rapid queries on every keystroke.
 * 
 * @param {*} value The value to debounce
 * @param {number} delay Delay in milliseconds (default 300ms)
 * @returns {*} The debounced value
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
