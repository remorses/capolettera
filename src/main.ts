import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { App } from './app'

const fontLink = document.createElement('link')
fontLink.href = 'https://fonts.googleapis.com/css2?family=Courier+Prime&display=swap'
fontLink.rel = 'stylesheet'
document.head.appendChild(fontLink)

document.fonts.ready.then(() => {
  const root = createRoot(document.getElementById('app')!)
  root.render(createElement(App))
})
