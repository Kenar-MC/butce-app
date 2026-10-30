import { HashRouter, Route, Routes } from 'react-router'
import Layout from './components/Layout'
import AccountsPage from './features/accounts/AccountsPage'
import BudgetPage from './features/budgets/BudgetPage'
import DashboardPage from './features/dashboard/DashboardPage'
import SettingsPage from './features/settings/SettingsPage'
import TransactionsPage from './features/transactions/TransactionsPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="islemler" element={<TransactionsPage />} />
          <Route path="hesaplar" element={<AccountsPage />} />
          <Route path="butce" element={<BudgetPage />} />
          <Route path="ayarlar" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
