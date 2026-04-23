'use client';

import { useEffect, useRef } from 'react';

export default function NtfyTracker() {
  const fired = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && !fired.current) {
      fired.current = true;
      fetch('https://ntfy.sh/dyork-typeset-alerts', {
        method: 'POST',
        headers: {
          'Tags': 'eyes'
        },
        body: 'New visitor arrived at Web Typography'
      }).catch(err => console.error('Tracker error:', err));
    }
  }, []);

  return null;
}
