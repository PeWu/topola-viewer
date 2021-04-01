import {IntlShape} from 'react-intl';
import {TopolaError} from './error';

/**
 * Returns a translated message for the given error. If the message can't be
 * translated, the original error.message is returned.
 */
export function getI18nMessage(error: Error, intl: IntlShape): string {
  if (!(error instanceof TopolaError)) {
    return error.message;
  }
  return intl.formatMessage(
    {
      id: `error.${error.code}`,
      defaultMessage: error.message,
    },
    error.args,
  );
}
