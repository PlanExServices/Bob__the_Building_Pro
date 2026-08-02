// Full script is loaded at runtime from full-script.txt
window.loadFullScript = function() {
  return fetch('full-script.txt').then(r => r.text());
};
