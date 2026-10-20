import { useEffect, useState } from 'react';
export function Toast({ message }: { message: string }) {
  const [text, setText] = useState(message);
  useEffect(() => {
    if (message) {
      setText(message);
      return;
    }
    const timer = setTimeout(
      () => setText(''),
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180,
    );
    return () => clearTimeout(timer);
  }, [message]);
  return text ? (
    <div className={'toast' + (!message ? ' is-leaving' : '')} role="status">
      {text}
    </div>
  ) : null;
}
