import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { GardenProvider, useGardens } from './garden/GardenContext'
import Layout from './components/Layout'
import LoginScreen from './screens/LoginScreen'
import PasswordResetScreen from './screens/PasswordResetScreen'
import TodayScreen from './screens/TodayScreen'
import CreateGardenScreen from './screens/CreateGardenScreen'
import OnboardingCropsScreen from './screens/OnboardingCropsScreen'
import EditGardenScreen from './screens/EditGardenScreen'
import PlantingsScreen from './screens/PlantingsScreen'
import PlantingDetailScreen from './screens/PlantingDetailScreen'
import CropsScreen from './screens/CropsScreen'
import CropDetailScreen from './screens/CropDetailScreen'
import GuideScreen from './screens/GuideScreen'
import GuideDetailScreen from './screens/GuideDetailScreen'
import CalendarScreen from './screens/CalendarScreen'
import JournalScreen from './screens/JournalScreen'
import HarvestsScreen from './screens/HarvestsScreen'
import ProfileScreen from './screens/ProfileScreen'
import SettingsScreen from './screens/SettingsScreen'
import PaywallScreen from './screens/PaywallScreen'
import VerifyEmailScreen from './screens/VerifyEmailScreen'

// Если у пользователя ещё нет участка — ведём на онбординг создания.
function GardenGate() {
  const { gardens, loading } = useGardens()
  if (loading) return <p className="p-6 font-bold text-muted">Загрузка…</p>
  if (gardens.length === 0) return <Navigate to="/garden/new" replace />
  return <Outlet />
}

export default function App() {
  const { isAuthed, loading } = useAuth()

  if (loading) {
    return <p className="p-6 font-bold text-muted">Загрузка…</p>
  }

  if (!isAuthed) {
    return (
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/reset-password" element={<PasswordResetScreen />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <GardenProvider>
      <Routes>
        <Route path="/garden/new" element={<CreateGardenScreen />} />
        <Route path="/garden/crops" element={<OnboardingCropsScreen />} />
        <Route element={<GardenGate />}>
          <Route element={<Layout />}>
            <Route path="/today" element={<TodayScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/garden/edit" element={<EditGardenScreen />} />
            <Route path="/plantings" element={<PlantingsScreen />} />
            <Route path="/plantings/:id" element={<PlantingDetailScreen />} />
            <Route path="/calendar" element={<CalendarScreen />} />
            <Route path="/crops" element={<CropsScreen />} />
            <Route path="/crops/:id" element={<CropDetailScreen />} />
            <Route path="/guide" element={<GuideScreen />} />
            <Route path="/guide/:slug" element={<GuideDetailScreen />} />
            <Route path="/journal" element={<JournalScreen />} />
            <Route path="/harvests" element={<HarvestsScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/paywall" element={<PaywallScreen />} />
            <Route path="/verify-email" element={<VerifyEmailScreen />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </GardenProvider>
  )
}
