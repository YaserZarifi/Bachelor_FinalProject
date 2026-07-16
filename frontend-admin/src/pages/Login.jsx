import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Alert,
  Paper,
  InputAdornment,
  IconButton,
} from '@mui/material'
import { LogIn, User, Lock, ShieldCheck, Sun, Moon, Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import { api, loginTokens } from '../api/client'
import toast from 'react-hot-toast'
import AuroraBackground from '../components/AuroraBackground'
import { useColorMode } from '../theme/ColorModeContext.jsx'

export default function LoginPage() {
  const navigate = useNavigate()
  const { mode, toggle } = useColorMode()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('auth/token/', { username, password })
      loginTokens(res.data.access, res.data.refresh)
      toast.success('خوش آمدید، مدیر!')
      navigate('/')
    } catch {
      setError('ورود ناموفق است یا دسترسی غیرمجاز.')
      toast.error('خطا در ورود')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AuroraBackground />

      <IconButton
        onClick={toggle}
        sx={{ position: 'fixed', top: 20, left: 20, zIndex: 2, color: 'text.primary' }}
        aria-label="تغییر تم"
      >
        {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </IconButton>

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Paper elevation={0} sx={{ p: 4, borderRadius: 5 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <Box
                  component="svg"
                  viewBox="0 0 48 48"
                  sx={{ width: 60, height: 60, filter: 'drop-shadow(0 10px 20px rgba(242,162,13,0.45))' }}
                >
                  <circle cx="24" cy="19" r="15" fill="none" stroke="#f2a20d" strokeWidth="1.6" opacity="0.4" />
                  <path
                    d="M24 6c-6.2 0-11 4.7-11 10.7 0 7.6 9.4 17.4 10.4 18.4a.9.9 0 0 0 1.3 0C25.6 34.1 35 24.3 35 16.7 35 10.7 30.2 6 24 6Z"
                    fill="#f9b526"
                  />
                  <circle cx="24" cy="16.4" r="4.4" fill="#0b1220" />
                  <circle cx="24" cy="16.4" r="1.9" fill="#34d399" />
                </Box>
              </Box>
              <Typography
                variant="overline"
                sx={{ fontWeight: 'bold', letterSpacing: 2, color: 'primary.main', fontFamily: '"Space Grotesk", sans-serif' }}
              >
                UrbanHelper Admin
              </Typography>
              <Typography variant="h4" component="h1" sx={{ mt: 0.5, fontWeight: 900 }}>
                داشبورد عملیاتی
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={submit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                  label="نام کاربری"
                  fullWidth
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <User size={18} />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  label="رمز عبور"
                  type={showPw ? 'text' : 'password'}
                  fullWidth
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock size={18} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPw((v) => !v)}
                          edge="end"
                          aria-label={showPw ? 'پنهان کردن رمز' : 'نمایش رمز'}
                          size="small"
                        >
                          {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={loading}
                  startIcon={<LogIn size={18} />}
                  sx={{ py: 1.5, fontSize: '1.05rem' }}
                >
                  {loading ? 'در حال ورود...' : 'ورود به داشبورد'}
                </Button>
              </Box>
            </form>

            <Box
              sx={{
                mt: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                color: 'text.secondary',
              }}
            >
              <ShieldCheck size={16} />
              <Typography variant="body2">نیاز به نقش کارمند (staff) در سامانه دارید.</Typography>
            </Box>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  )
}
