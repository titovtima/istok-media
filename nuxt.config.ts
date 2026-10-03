export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  nitro: { experimental: { websocket: true } },
  css: ['~/assets/main.css'],
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
  },
  app: {
    head: {
      title: 'Источник Жизни — медиаслужение',
      titleTemplate: (titleChunk) =>
        titleChunk ? `${titleChunk} · Источник Жизни` : 'Источник Жизни — медиаслужение',
      htmlAttrs: { lang: 'ru' },
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Anonymous+Pro:wght@400;700&family=Golos+Text:wght@500;600;700&display=swap',
        },
      ],
      meta: [
        { name: 'theme-color', content: '#162781' },
      ],
    },
  },
})
