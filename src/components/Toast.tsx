import { useLayoutEffect, useState } from 'react';
import { usePresence } from '../hooks/useMotion';
export function Toast({ message }: { message: string }) {
  const [text, setText] = useState(message);
  const present = usePresence(!!message, 'overlay');
  useLayoutEffect(() => {
    if (message) setText(message);
  }, [message]);
  return present ? (
    <div className={'toast' + (!message ? ' is-leaving' : '')} role="status">
      {message || text}
    </div>
  ) : null;
}
