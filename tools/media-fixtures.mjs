/** Self-authored silent MPEG-1 Layer III frames; no private recording is included. */
export function silentMp3() {
  const frames = new Uint8Array(417 * 48);
  for (let i = 0; i < 48; i++) frames.set([255, 251, 144, 192], i * 417);
  return frames;
}
/** Record a tiny synthetic canvas using the browser's own encoder, not a transcoder. */
export async function syntheticMp4(page) {
  return new Uint8Array(
    await page.evaluate(async () => {
      const mime = [
        'video/mp4;codecs=avc1.42001E',
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mime)
        throw new Error('Synthetic MP4 fixture needs a browser with native MP4 recording support');
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const context = canvas.getContext('2d'),
        stream = canvas.captureStream(10),
        parts = [];
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 64000 });
      const done = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = reject;
      });
      recorder.ondataavailable = (event) => {
        if (event.data.size) parts.push(event.data);
      };
      let frame = 0;
      const timer = setInterval(() => {
        context.fillStyle = frame++ % 2 ? '#526d82' : '#2e4152';
        context.fillRect(0, 0, 160, 90);
      }, 50);
      try {
        recorder.start();
        await new Promise((resolve) => setTimeout(resolve, 1200));
        recorder.stop();
        await done;
        return Array.from(new Uint8Array(await new Blob(parts).arrayBuffer()));
      } finally {
        clearInterval(timer);
        stream.getTracks().forEach((track) => track.stop());
      }
    }),
  );
}
