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
import { LogIn, User, Lock, ShieldCheck, Sun, Moon, MapPin, Eye, EyeOff } from 'lucide-react'
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
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  mx: 'auto',
                  mb: 2,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  boxShadow: '0 12px 30px -8px rgba(99,102,241,0.6)',
                }}
              >
                <MapPin size={30} />
              </Box>
              <Typography
                variant="overline"
                color="primary"
                sx={{ fontWeight: 'bold', letterSpacing: 2 }}
              >
                UrbanHelper Admin
              </Typography>
              <Typography variant="h4" component="h1" sx={{ mt: 0.5, fontWeight: 900 }}>
                پنل مدیریت هوشمند
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
