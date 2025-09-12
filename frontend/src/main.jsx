import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Enhanced startup logging
console.log('🎯 CodeDog Frontend - Starting Application...')
console.log('📊 React Version:', React.version)
console.log('🌍 Environment:', {
  mode: import.meta.env.MODE,
  dev: import.meta.env.DEV,
  prod: import.meta.env.PROD,
  baseUrl: import.meta.env.BASE_URL
})

const rootElement = document.getElementById('root')
if (!rootElement) {
  console.error('❌ Root element not found!')
  throw new Error('Root element not found')
}

console.log('✅ Root element found, creating React root...')

const root = ReactDOM.createRoot(rootElement)

console.log('🚀 Rendering App component...')

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

console.log('✅ App component rendered successfully!')