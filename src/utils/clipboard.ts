/**
 * Copies the given text to the clipboard.
 * Falls back to the deprecated execCommand API in non-secure contexts.
 */
export const copyToClipboard = (text: string): Promise<boolean> => {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text)
      .then(() => true)
      .catch(() => false);
  }

  // Fallback for insecure contexts
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return Promise.resolve(successful);
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err);
    return Promise.resolve(false);
  }
};
