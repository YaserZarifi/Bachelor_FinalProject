import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  InputAdornment,
  Tooltip as MuiTooltip,
  useMediaQuery,
} from '@mui/material';
import {
  LayoutDashboard,
  BarChart3,
  LogOut,
  Search,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  ListChecks,
  Sun,
  Moon,
  Inbox,
  MapPin,
  Menu as MenuIcon,
  Brain,
  ImageOff,
  Activity,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { motion } from 'framer-motion';
import { useTheme } from '@mui/material/styles';
import { api, flattenFeatures, logoutClient, mediaUrl } from '../api/client';
import toast from 'react-hot-toast';
import AuroraBackground from '../components/AuroraBackground';
import CountUp from '../components/CountUp';
import { useColorMode } from '../theme/ColorModeContext.jsx';

const DRAWER_WIDTH = 280;

const DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const STATUS_COLORS = {
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  ASSIGNED: 'secondary',
  IN_PROGRESS: 'primary',
  RESOLVED: 'success',
  CLOSED: 'default',
};

const STATUSES = [
  ['SUBMITTED', 'ثبت شده'],
  ['UNDER_REVIEW', 'در حال بررسی'],
  ['ASSIGNED', 'ارجاع داده‌شده'],
  ['IN_PROGRESS', 'در حال اقدام'],
  ['RESOLVED', 'حل‌شده'],
  ['CLOSED', 'مختومه'],
];
const STATUS_LABEL = Object.fromEntries(STATUSES);
const PIE_COLORS = ['#06b6d4', '#f59e0b', '#8b5cf6', '#6366f1', '#10b981', '#64748b'];

// Mirrors backend ALLOWED_STATUS_TRANSITIONS so the UI only offers legal moves.
const ALLOWED_NEXT = {
  SUBMITTED: ['UNDER_REVIEW', 'ASSIGNED'],
  UNDER_REVIEW: ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS'],
  ASSIGNED: ['IN_PROGRESS', 'UNDER_REVIEW'],
  IN_PROGRESS: ['RESOLVED', 'ASSIGNED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
};

const STATUS_HEX = {
  SUBMITTED: '#06b6d4',
  UNDER_REVIEW: '#f59e0b',
  ASSIGNED: '#8b5cf6',
  IN_PROGRESS: '#6366f1',
  RESOLVED: '#10b981',
  CLOSED: '#64748b',
};

// The API may return geometry either as GeoJSON ({type, coordinates:[lng,lat]})
// or as an EWKT/WKT string ("SRID=4326;POINT (lng lat)"). Normalize both to
// a Leaflet [lat, lng] pair.
function toLatLng(geometry) {
  if (!geometry) return null;
  if (typeof geometry === 'object' && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates;
    return [lat, lng];
  }
  if (typeof geometry === 'string') {
    const m = geometry.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (m) return [parseFloat(m[2]), parseFloat(m[1])];
  }
  return null;
}

// Custom colored teardrop pin (no image asset → always renders). Urgent
// reports get a rose pin with a pulsing halo so they stand out on the map.
function pinIcon(status, urgent) {
  const color = urgent ? '#f43f5e' : STATUS_HEX[status] || '#6366f1';
  const halo = urgent
    ? `<span style="position:absolute;left:50%;top:0;transform:translate(-50%,-2px);width:30px;height:30px;border-radius:50%;background:${color};opacity:.35;animation:pinpulse 1.6s ease-out infinite"></span>`
    : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:26px;height:26px">${halo}
      <div style="position:absolute;left:50%;top:50%;width:22px;height:22px;transform:translate(-50%,-55%) rotate(-45deg);background:${color};border-radius:50% 50% 50% 0;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.45)"></div>
      <div style="position:absolute;left:50%;top:50%;width:7px;height:7px;transform:translate(-50%,-70%);background:#fff;border-radius:50%"></div>
    </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 24],
    popupAnchor: [0, -22],
  });
}

// Drives the map view: zoom to the selected report, otherwise fit ALL reports
// (whatever is currently filtered) into one viewport.
function MapController({ points, selectedPoint }) {
  const map = useMap();
  useEffect(() => {
    if (selectedPoint) {
      map.flyTo(selectedPoint, 15, { duration: 0.8 });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    } else if (points.length > 1) {
      map.fitBounds(points, { padding: [60, 60], maxZoom: 15 });
    }
  }, [points, selectedPoint, map]);
  return null;
}

function fmtDate(s) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function Meta({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {value || '—'}
      </Typography>
    </Box>
  );
}

function DetailPhoto({ src, label }) {
  if (!src) {
    return (
      <Box
        sx={{
          height: 120,
          borderRadius: 2,
          border: '1px dashed',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          color: 'text.secondary',
        }}
      >
        <ImageOff size={22} />
        <Typography variant="caption">{label}</Typography>
      </Box>
    );
  }
  return (
    <Box
      component="a"
      href={mediaUrl(src)}
      target="_blank"
      rel="noreferrer"
      sx={{
        position: 'relative',
        display: 'block',
        height: 120,
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        component="img"
        src={mediaUrl(src)}
        alt={label}
        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: 6,
          right: 6,
          px: 1,
          py: 0.25,
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          color: '#fff',
          bgcolor: 'rgba(15,23,42,0.7)',
        }}
      >
        {label}
      </Box>
    </Box>
  );
}

function KpiCard({ icon: Icon, label, value, color, delay }) {
  return (
    <Grid item xs={6} md={3}>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay }}
      >
        <Card sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                background: color,
                flexShrink: 0,
              }}
            >
              <Icon size={24} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1 }}>
                <CountUp value={value} />
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {label}
              </Typography>
            </Box>
          </Box>
        </Card>
      </motion.div>
    </Grid>
  );
}

export default function Dashboard() {
  const muiTheme = useTheme();
  const { mode, toggle } = useColorMode();
  const isDesktop = useMediaQuery(muiTheme.breakpoints.up('md'));
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [nextStatus, setNextStatus] = useState('');
  const [afterFile, setAfterFile] = useState(null);

  // Open the drawer by default on desktop, collapse it on small screens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrawerOpen(isDesktop);
  }, [isDesktop]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('reports/');
      setFeatures(flattenFeatures(res.data));
    } catch {
      toast.error('خطا در بارگذاری گزارش‌ها');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const filtered = useMemo(() => {
    return features.filter((f) => {
      const p = f.properties || {};
      if (statusFilter && p.status !== statusFilter) return false;
      if (urgentOnly && !p.is_urgent) return false;
      if (search && !(p.description || '').includes(search)) return false;
      return true;
    });
  }, [features, statusFilter, urgentOnly, search]);

  const selected = filtered.find((f) => String(f.id) === String(selectedId));
  const allowedNext = selected ? ALLOWED_NEXT[selected.properties?.status] || [] : [];

  // Reset the transition form whenever a different report is selected.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNextStatus('');
    setAfterFile(null);
  }, [selectedId]);

  const center = useMemo(() => {
    const active = selected || filtered[0];
    return toLatLng(active?.geometry) || [35.6892, 51.389];
  }, [filtered, selected]);

  // All visible report points as [lat, lng] (for fit-bounds), and the selected one.
  const points = useMemo(
    () => filtered.map((f) => toLatLng(f.geometry)).filter(Boolean),
    [filtered],
  );
  const selectedPoint = useMemo(() => toLatLng(selected?.geometry), [selected]);

  // KPI metrics derived from already-fetched reports (no extra API call).
  const kpis = useMemo(() => {
    const total = features.length;
    let urgent = 0;
    let inProgress = 0;
    let resolved = 0;
    features.forEach((f) => {
      const p = f.properties || {};
      if (p.is_urgent) urgent += 1;
      if (p.status === 'IN_PROGRESS') inProgress += 1;
      if (p.status === 'RESOLVED' || p.status === 'CLOSED') resolved += 1;
    });
    return { total, urgent, inProgress, resolved };
  }, [features]);

  const chartData = useMemo(() => {
    const stats = {};
    features.forEach((f) => {
      const s = f.properties?.status || 'UNKNOWN';
      stats[s] = (stats[s] || 0) + 1;
    });
    return Object.entries(stats).map(([name, value]) => ({
      name,
      label: STATUS_LABEL[name] || name,
      value,
    }));
  }, [features]);

  // Reports per day (chronological) for the trend chart.
  const timeSeries = useMemo(() => {
    const m = {};
    features.forEach((f) => {
      const d = f.properties?.created_at;
      if (!d) return;
      const key = d.slice(0, 10);
      m[key] = (m[key] || 0) + 1;
    });
    return Object.entries(m)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        date: k,
        label: new Date(k).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }),
        value: v,
      }));
  }, [features]);

  // Reports grouped by category (falls back to the AI-suggested category).
  const categoryData = useMemo(() => {
    const m = {};
    features.forEach((f) => {
      const c =
        f.properties?.category_name ||
        f.properties?.nlp_meta?.suggested_category ||
        'نامشخص';
      m[c] = (m[c] || 0) + 1;
    });
    return Object.entries(m)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [features]);

  const handleStatusChange = async () => {
    if (!selected || !nextStatus) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('status', nextStatus);
    if (afterFile) fd.append('image_after', afterFile);

    try {
      await api.post(`reports/${selected.id}/transition/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('وضعیت با موفقیت به‌روز شد');
      setNextStatus('');
      setAfterFile(null);
      await load();
    } catch (err) {
      const data = err.response?.data;
      const pick = (v) => (Array.isArray(v) ? v[0] : v);
      const message =
        pick(data?.status) ||
        pick(data?.image_after) ||
        pick(data?.detail) ||
        pick(data?.non_field_errors) ||
        'خطا در تغییر وضعیت';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    logoutClient();
    window.location.href = '/login';
  };

  const tooltipStyle = {
    backgroundColor: mode === 'dark' ? '#0f172a' : '#ffffff',
    border: `1px solid ${muiTheme.palette.divider}`,
    borderRadius: 12,
    color: muiTheme.palette.text.primary,
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <AuroraBackground />

      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen((o) => !o)}
            sx={{ ml: 1 }}
            aria-label="باز و بستن منو"
          >
            <MenuIcon size={22} />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1, fontWeight: 800 }}>
            داشبورد عملیاتی شهریاور
          </Typography>
          <MuiTooltip title={mode === 'dark' ? 'حالت روشن' : 'حالت تاریک'}>
            <IconButton color="inherit" onClick={toggle}>
              {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </IconButton>
          </MuiTooltip>
          <MuiTooltip title="خروج">
            <IconButton color="inherit" onClick={handleLogout}>
              <LogOut size={20} />
            </IconButton>
          </MuiTooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        anchor="right"
        sx={{
          flexShrink: 0,
          width: drawerOpen ? DRAWER_WIDTH : 0,
          transition: muiTheme.transitions.create('width', {
            duration: muiTheme.transitions.duration.enteringScreen,
          }),
          '& .MuiDrawer-paper': {
            position: 'relative',
            width: drawerOpen ? DRAWER_WIDTH : 0,
            height: 'auto',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            overflowX: 'hidden',
            border: 0,
            borderLeft: drawerOpen ? `1px solid ${muiTheme.palette.divider}` : 0,
            transition: muiTheme.transitions.create('width', {
              duration: muiTheme.transitions.duration.enteringScreen,
            }),
          },
        }}
      >
        {/* Spacer so drawer content clears the fixed AppBar */}
        <Toolbar />
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            width: DRAWER_WIDTH,
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              mx: 'auto',
              mb: 1.5,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              boxShadow: '0 12px 28px -10px rgba(99,102,241,0.6)',
            }}
          >
            <MapPin size={26} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            شهریاور
          </Typography>
          <Typography variant="caption" color="text.secondary">
            پنل نظارتی مدیران
          </Typography>
        </Box>
        <Divider sx={{ opacity: 0.5 }} />
        <List sx={{ px: 2, py: 1 }}>
          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton selected>
              <ListItemIcon sx={{ minWidth: 40, color: 'primary.main' }}>
                <LayoutDashboard size={20} />
              </ListItemIcon>
              <ListItemText primary="بررسی گزارش‌ها" primaryTypographyProps={{ fontWeight: 700 }} />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <BarChart3 size={20} />
              </ListItemIcon>
              <ListItemText primary="آمار و ارقام" />
            </ListItemButton>
          </ListItem>
        </List>

        <Box sx={{ mt: 'auto', p: 2 }}>
          <Card sx={{ borderColor: 'primary.main' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1.5 }}>
                جستجوی پیشرفته
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="جستجو در توضیحات..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              <TextField
                select
                size="small"
                fullWidth
                label="وضعیت"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{ mb: 2 }}
              >
                <MenuItem value="">همه</MenuItem>
                {STATUSES.map(([k, v]) => (
                  <MenuItem key={k} value={k}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                fullWidth
                variant={urgentOnly ? 'contained' : 'outlined'}
                color="error"
                size="small"
                startIcon={<AlertTriangle size={16} />}
                onClick={() => setUrgentOnly((v) => !v)}
              >
                {urgentOnly ? 'فقط موارد بحرانی' : 'نمایش همه'}
              </Button>
            </CardContent>
          </Card>
        </Box>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          height: '100vh',
          overflowY: 'auto',
          p: 3,
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {/* Spacer so content clears the fixed AppBar */}
        <Toolbar sx={{ p: 0, minHeight: { xs: 56, sm: 64 }, flexShrink: 0 }} />

        {/* KPI row */}
        <Grid container spacing={3}>
          <KpiCard icon={ListChecks} label="کل گزارش‌ها" value={kpis.total} color="linear-gradient(135deg,#6366f1,#06b6d4)" delay={0} />
          <KpiCard icon={AlertTriangle} label="موارد بحرانی" value={kpis.urgent} color="linear-gradient(135deg,#f43f5e,#f59e0b)" delay={0.08} />
          <KpiCard icon={Wrench} label="در حال اقدام" value={kpis.inProgress} color="linear-gradient(135deg,#4f46e5,#8b5cf6)" delay={0.16} />
          <KpiCard icon={CheckCircle2} label="رسیدگی‌شده" value={kpis.resolved} color="linear-gradient(135deg,#10b981,#14b8a6)" delay={0.24} />
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <Card sx={{ height: 500, overflow: 'hidden', position: 'relative' }}>
              {selectedId && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<LayoutDashboard size={16} />}
                  onClick={() => setSelectedId(null)}
                  sx={{ position: 'absolute', top: 12, left: 12, zIndex: 1000 }}
                >
                  نمایش همه روی نقشه
                </Button>
              )}
              <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapController points={points} selectedPoint={selectedPoint} />
                {filtered.map((f) => {
                  const ll = toLatLng(f.geometry);
                  if (!ll) return null;
                  return (
                    <Marker
                      key={f.id}
                      position={ll}
                      icon={pinIcon(f.properties?.status, f.properties?.is_urgent)}
                      eventHandlers={{ click: () => setSelectedId(f.id) }}
                    >
                      <Popup>
                        <Typography variant="subtitle2">گزارش #{f.id}</Typography>
                        <Typography variant="body2">
                          {STATUS_LABEL[f.properties?.status] || f.properties?.status}
                        </Typography>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </Card>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Card sx={{ height: 500, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 2, borderBottom: `1px solid ${muiTheme.palette.divider}` }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  لیست گزارش‌ها
                  <Chip label={filtered.length} size="small" sx={{ ml: 1 }} color="primary" />
                </Typography>
              </Box>
              <List sx={{ overflowY: 'auto', flexGrow: 1, p: 1 }}>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : filtered.length === 0 ? (
                  <Box sx={{ textAlign: 'center', p: 4, color: 'text.secondary' }}>
                    <Inbox size={36} style={{ opacity: 0.5 }} />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      گزارشی یافت نشد
                    </Typography>
                  </Box>
                ) : (
                  filtered.map((f) => (
                    <ListItemButton
                      key={f.id}
                      selected={selectedId === f.id}
                      onClick={() => setSelectedId(f.id)}
                      sx={{ mb: 1, flexDirection: 'column', alignItems: 'flex-start' }}
                    >
                      <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          #{f.id}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {f.properties?.is_urgent && (
                            <Chip label="بحرانی" size="small" color="error" />
                          )}
                          <Chip
                            label={STATUS_LABEL[f.properties?.status] || f.properties?.status}
                            size="small"
                            color={STATUS_COLORS[f.properties?.status] || 'default'}
                            variant="outlined"
                          />
                        </Box>
                      </Box>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ width: '100%' }}>
                        {f.properties?.description}
                      </Typography>
                    </ListItemButton>
                  ))
                )}
              </List>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ p: 2.5, height: '100%' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                توزیع وضعیت گزارش‌ها
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <defs>
                      <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: muiTheme.palette.text.secondary }} />
                    <YAxis allowDecimals={false} tick={{ fill: muiTheme.palette.text.secondary }} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                    <Bar dataKey="value" fill="url(#barFill)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ p: 2.5, height: '100%' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                نمای کلی
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={3}
                    >
                      {chartData.map((entry, i) => (
                        <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Card>
          </Grid>

          {selected && (
            <Grid item xs={12}>
              <Card sx={{ p: 3, borderColor: 'primary.main' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    جزئیات گزارش #{selected.id}
                  </Typography>
                  {selected.properties?.is_urgent && (
                    <Chip icon={<AlertTriangle size={14} />} label="بحرانی" color="error" />
                  )}
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={7}>
                <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.9 }}>
                  {selected.properties?.description}
                </Typography>

                {/* Before / after images */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
                  <DetailPhoto src={selected.properties?.image_before} label="قبل" />
                  <DetailPhoto
                    src={selected.properties?.image_after}
                    label={selected.properties?.image_after ? 'بعد از رسیدگی' : 'در انتظار تصویر بعد'}
                  />
                </Box>

                {/* Metadata grid */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
                  <Meta label="دسته‌بندی" value={selected.properties?.category_name || 'تشخیص خودکار'} />
                  <Meta
                    label="گزارش‌دهنده"
                    value={selected.properties?.user ? `کاربر #${selected.properties.user}` : 'مهمان'}
                  />
                  <Meta label="منبع تصویر" value={selected.properties?.capture_source} />
                  <Meta
                    label="دقت موقعیت"
                    value={
                      selected.properties?.gps_accuracy
                        ? `±${Math.round(selected.properties.gps_accuracy)} متر`
                        : null
                    }
                  />
                  <Meta label="زمان ثبت" value={fmtDate(selected.properties?.created_at)} />
                  <Meta label="آخرین تغییر" value={fmtDate(selected.properties?.updated_at)} />
                </Box>

                {/* AI analysis */}
                {selected.properties?.nlp_meta && (
                  <Box
                    sx={{
                      p: 1.5,
                      mb: 2,
                      borderRadius: 2,
                      bgcolor: 'rgba(99,102,241,0.08)',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}
                    >
                      <Brain size={14} /> تحلیل هوش مصنوعی
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                      <Meta label="دسته پیشنهادی" value={selected.properties.nlp_meta.suggested_category} />
                      <Meta label="احساسات متن" value={selected.properties.nlp_meta.sentiment_label_fa} />
                      <Meta
                        label="اطمینان دسته‌بندی"
                        value={
                          selected.properties.nlp_meta.category_confidence != null
                            ? `${Math.round(selected.properties.nlp_meta.category_confidence * 100)}٪`
                            : null
                        }
                      />
                      <Meta
                        label="شاخص بحران"
                        value={selected.properties.nlp_meta.crisis_score}
                      />
                    </Box>
                  </Box>
                )}
                  </Grid>

                  <Grid item xs={12} md={5}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    وضعیت فعلی:
                  </Typography>
                  <Chip
                    label={STATUS_LABEL[selected.properties?.status] || selected.properties?.status}
                    size="small"
                    color={STATUS_COLORS[selected.properties?.status] || 'default'}
                  />
                </Box>

                {allowedNext.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    این گزارش مختومه است و قابل تغییر نیست.
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      select
                      label="انتقال به وضعیت بعدی"
                      size="small"
                      fullWidth
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value)}
                      disabled={busy}
                      helperText="فقط مراحل مجاز نمایش داده می‌شوند"
                    >
                      {allowedNext.map((k) => (
                        <MenuItem key={k} value={k}>
                          {STATUS_LABEL[k]}
                        </MenuItem>
                      ))}
                    </TextField>

                    {nextStatus === 'RESOLVED' && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                          تصویر بعد (الزامی برای وضعیت حل‌شده):
                        </Typography>
                        <Button variant="outlined" component="label" size="small" fullWidth>
                          {afterFile ? afterFile.name : 'انتخاب تصویر…'}
                          <input
                            hidden
                            type="file"
                            accept="image/*"
                            onChange={(e) => setAfterFile(e.target.files?.[0] || null)}
                          />
                        </Button>
                      </Box>
                    )}

                    <Button
                      variant="contained"
                      fullWidth
                      onClick={handleStatusChange}
                      disabled={busy || !nextStatus || (nextStatus === 'RESOLVED' && !afterFile)}
                      startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <CheckCircle2 size={16} />}
                    >
                      ثبت تغییر وضعیت
                    </Button>
                  </Box>
                )}
                  </Grid>
                </Grid>
              </Card>
            </Grid>
          )}
        </Grid>

        {/* Extended analytics */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Card sx={{ p: 2.5, height: '100%' }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Activity size={18} /> روند ثبت گزارش‌ها در زمان
              </Typography>
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeries}>
                    <defs>
                      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: muiTheme.palette.text.secondary }} />
                    <YAxis allowDecimals={false} tick={{ fill: muiTheme.palette.text.secondary }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      name="گزارش‌ها"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#areaFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12} md={5}>
            <Card sx={{ p: 2.5, height: '100%' }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <BarChart3 size={18} /> گزارش‌ها بر اساس دسته‌بندی
              </Typography>
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: muiTheme.palette.text.secondary }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 11, fill: muiTheme.palette.text.secondary }}
                    />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                    <Bar dataKey="value" name="تعداد" fill="#06b6d4" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
