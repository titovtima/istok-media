// Регистрация service worker. Подключается в <head> через nuxt.config.
// Дальше SW будет использоваться для push-уведомлений.
(function () {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(function (err) {
        console.warn('[sw] registration failed:', err)
      })
  })
})()
