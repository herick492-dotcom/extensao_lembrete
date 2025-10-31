// Ouve por mensagens vindas do service worker (background.js)
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.target === 'offscreen' && msg.type === 'play-audio') {
    // Pega o elemento de áudio do HTML
    const audio = document.querySelector('#audio-player');
    
    // Toca o som
    await audio.play();
  }
});