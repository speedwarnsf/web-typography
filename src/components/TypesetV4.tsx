'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import * as api from '@/lib/v4/typeset.release';

const scope = ':is(main, article) :is(p, li, blockquote, figcaption, h1, h2, h3, h4):not([data-no-typeset], [data-no-typeset] *, .demo *, [role="tabpanel"] *, [data-typeset-react] *, [data-typeset-react-rich] *)';

/** Static editorial copy only. Interactive demonstrations own their refs. */
export default function TypesetV4() {
  const pathname = usePathname();
  useEffect(() => {
    window.Typeset = api;
    const controller = api.mount(document, scope, { smartQuotes: 'en', opticalHanging: true });
    window.TypesetReady = controller.ready.then(() => controller);
    return () => controller.disconnect();
  }, [pathname]);
  return null;
}
