import type { TFunction } from 'i18next';
import { BluffApiError } from '../api/bluff';

const ONLINE_ERRORS: Record<string, string> = {
  unauthorized: 'online.errors.unauthorized', not_found: 'online.errors.notFound',
  started: 'online.errors.started', full: 'online.errors.full', stale_version: 'online.errors.stale',
  not_playing: 'online.errors.notPlaying', invalid_body: 'online.errors.invalid',
  request_reused: 'online.errors.invalid', pseudo_required: 'online.errors.unauthorized', unavailable: 'online.errors.network',
};
export function bluffErrorMessage(error: unknown, t: TFunction): string {
  if (!(error instanceof BluffApiError)) return t('online.errors.network');
  if (error.status === 422) return t(`errors.${error.code}`, error.params);
  return t(ONLINE_ERRORS[error.code] ?? 'online.errors.network');
}
