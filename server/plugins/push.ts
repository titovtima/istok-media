import { startPushScheduler } from '~~/server/utils/push-scheduler'

export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_PUSH_SCHEDULER === 'true') {
    startPushScheduler()
  } else {
    console.log('[push-scheduler] disabled in dev (set ENABLE_PUSH_SCHEDULER=true to enable)')
  }
})
