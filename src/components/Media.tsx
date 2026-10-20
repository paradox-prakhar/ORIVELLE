import { useState, type ImgHTMLAttributes } from 'react';

export function Media({ className = '', alt = '', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);
  return <span className={`media ${className} ${failed ? 'media-failed' : ''}`}>
    {!failed ? <img {...props} alt={alt} onError={() => setFailed(true)} /> : <span className="media-error"><span>이미지</span><small>{alt}<br />Image temporarily unavailable</small></span>}
  </span>;
}
