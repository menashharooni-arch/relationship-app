// Returns a thumbnail image URL for a video link (YouTube / Vimeo), or null if
// the URL isn't a recognized video. Used to show the actual video frame on Swift Links.
export function videoThumbnail(url: string | undefined | null): string | null {
  if (!url) return null;
  const u = url.trim();

  // YouTube: watch?v=, youtu.be/, embed/, shorts/
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`;

  // Vimeo (thumbnail proxy)
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://vumbnail.com/${vm[1]}.jpg`;

  return null;
}

// Returns an autoplaying embed URL for a video link (YouTube / Vimeo), or null.
// Lets Swift Links play the video inline instead of navigating away.
export function videoEmbed(url: string | undefined | null): string | null {
  if (!url) return null;
  const u = url.trim();

  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&playsinline=1&rel=0`;

  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1&playsinline=1`;

  return null;
}
