'use client';

import { useEffect } from 'react';

export type ElevenLabsProps = {
  publicUserId: string;
  textColorRgba?: string;
  backgroundColorRgba?: string;
  size?: 'small' | 'large';
  children?: React.ReactNode;
  projectId?: string;
};

export const ElevenLabsAudioNative = ({
  publicUserId,
  size,
  textColorRgba,
  backgroundColorRgba,
  children,
  projectId,
}: ElevenLabsProps) => {
  useEffect(() => {
    const script = document.createElement('script');

    script.src = 'https://elevenlabs.io/player/audioNativeHelper.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Only remove if it exists to prevent errors
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <div
      id="elevenlabs-audionative-widget"
      data-height={size === 'small' ? '90' : '120'}
      data-width="100%"
      data-frameborder="no"
      data-scrolling="no"
      data-publicuserid={publicUserId}
      data-playerurl="https://elevenlabs.io/player/index.html"
      data-small={size === 'small' ? 'True' : 'False'}
      data-textcolor={textColorRgba ?? 'rgba(0, 0, 0, 1.0)'}
      data-backgroundcolor={backgroundColorRgba ?? 'rgba(255, 255, 255, 1.0)'}
      {...(projectId && { 'data-projectid': projectId })}
    >
      {children ? children : 'Loading ElevenLabs AudioNative Player...'}
    </div>
  );
};

export default ElevenLabsAudioNative;