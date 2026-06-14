import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'
import { prefixer } from 'stylis'
import rtlPlugin from 'stylis-plugin-rtl'
import { Toaster } from 'react-hot-toast'
import { useMemo } from 'react'
import { createAppTheme } from './theme'
import { ColorModeContext, useProvideColorMode } from './theme/ColorModeContext.jsx'
import './index.css'
import App from './App.jsx'

// Create rtl cache
const cacheRtl = createCache({
  key: 'muirtl',
  stylisPlugins: [prefixer, rtlPlugin],
})

// eslint-disable-next-line react-refresh/only-export-components
function Root() {
  const colorMode = useProvideColorMode()
  const theme = useMemo(() => createAppTheme(colorMode.mode), [colorMode.mode])

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Toaster position="top-center" />
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CacheProvider value={cacheRtl}>
      <Root />
    </CacheProvider>
  </StrictMode>,
)
