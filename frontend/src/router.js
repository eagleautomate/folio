import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'Home', component: () => import('@/pages/Home.vue') },
  { path: '/p/:name', name: 'Page', component: () => import('@/pages/Page.vue'), props: true },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('@/pages/NotFound.vue') },
]

export default createRouter({
  history: createWebHistory('/folio'),
  routes,
})
