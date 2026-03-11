import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

NProgress.configure({ showSpinner: false, trickleSpeed: 200 })

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hooks.hook('page:start', () => { NProgress.start() })
  nuxtApp.hooks.hook('page:finish', () => { NProgress.done() })
  nuxtApp.hooks.hook('vue:error', () => { NProgress.done() })
})
