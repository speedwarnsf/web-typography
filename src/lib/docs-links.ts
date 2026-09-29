/**
 * Links the /docs and /help pages share. Repository documents are linked as
 * GitHub renders them at the tag of the release the site pins, so the page
 * and the text it points to describe the same version.
 */
import { PINNED_VERSION } from './install-snippet';

export const REPO = 'https://github.com/speedwarnsf/web-typography';

/** A repository file, rendered by GitHub, at tag v<PINNED_VERSION>. */
export const repoDoc = (path: string): string => `${REPO}/blob/v${PINNED_VERSION}/${path}`;

/** The issue forms in .github/ISSUE_TEMPLATE. */
export const BAD_BREAK_FORM = `${REPO}/issues/new?template=bad-break.yml`;
export const INTEGRATION_FORM = `${REPO}/issues/new?template=integration-question.yml`;

/** The maintainer's address, as SECURITY.md and CODE_OF_CONDUCT.md give it. */
export const CONTACT_EMAIL = 'dyork@typeset.us';
