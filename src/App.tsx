import { HashRouter, Route, Routes } from 'react-router'
import Layout from './components/Layout'
import DashboardPage from './features/dashboard/DashboardPage'
import ImportPage from './features/import/ImportPage'
import SettingsPage from './features/settings/SettingsPage'
import StatementDetailPage from './features/statements/StatementDetailPage'
import StatementsPage from './features/statements/StatementsPage'
import TrendPage from './features/trend/TrendPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="trend" element={<TrendPage />} />
          <Route path="ekstreler" element={<StatementsPage />} />
          <Route path="ekstreler/:id" element={<StatementDetailPage />} />
          <Route path="ayarlar" element={<SettingsPage />} />
          <Route path="ice-aktar" element={<ImportPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
