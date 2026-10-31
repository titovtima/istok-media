import { getVapidPublicKey } from '~~/server/utils/push'

export default defineEventHandler(() => {
  return { publicKey: getVapidPublicKey() }
})
