
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { TasksPage } from './pages/Tasks';
import { ProjectsPage } from './pages/Projects';
import { TeamsPage } from './pages/Teams';
import { AgendaPage } from './pages/Agenda';
import { AuthProvider } from './context/AuthContext';
import { RBACProvider } from './context/RBACContext';
import { TenantProvider } from './context/TenantContext'; // Added
import { ThemeProvider } from './context/ThemeContext';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SettingsPage } from './pages/Settings';

// Super Admin Pages
import { SuperAdminDashboard } from './pages/SuperAdmin/Dashboard';
import { SuperAdminUsers } from './pages/SuperAdmin/Users';
import { SuperAdminAdmins } from './pages/SuperAdmin/Admins';
import { SuperAdminPlans } from './pages/SuperAdmin/Plans';

// Financial Pages
import { FinancialOverview } from './pages/finance/Overview';
import { FinancialTransactions } from './pages/finance/Transactions';
import { FinancialAccounts } from './pages/finance/Accounts';
import { FinancialCategories } from './pages/finance/Categories';
import { FinancialCards } from './pages/finance/Cards';
import { FinancialReports } from './pages/finance/Reports';

// Commercial Pages
import { ContactsPage } from './pages/commercial/Contacts';
import { CatalogPage } from './pages/commercial/Catalog';
import { QuotesPage } from './pages/commercial/Quotes';
import { RecurringPage } from './pages/commercial/Recurring';

// Routines Pages
import { RoutinesOverview } from './pages/routines/Overview';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <RBACProvider> 
        <TenantProvider>
            <ThemeProvider>
            <Router>
                <Routes>
                {/* Rotas Públicas */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Rotas Protegidas */}
                <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
                
                {/* Routines & Execution */}
                <Route path="/routines/overview" element={<ProtectedRoute><Layout><RoutinesOverview /></Layout></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute><Layout><TasksPage /></Layout></ProtectedRoute>} />
                <Route path="/projects" element={<ProtectedRoute><Layout><ProjectsPage /></Layout></ProtectedRoute>} />
                <Route path="/teams" element={<ProtectedRoute><Layout><TeamsPage /></Layout></ProtectedRoute>} />
                <Route path="/agenda" element={<ProtectedRoute><Layout><AgendaPage /></Layout></ProtectedRoute>} />

                {/* Commercial Routes */}
                <Route path="/commercial/contacts" element={<ProtectedRoute><Layout><ContactsPage /></Layout></ProtectedRoute>} />
                <Route path="/commercial/catalog" element={<ProtectedRoute><Layout><CatalogPage /></Layout></ProtectedRoute>} />
                <Route path="/commercial/quotes" element={<ProtectedRoute><Layout><QuotesPage /></Layout></ProtectedRoute>} />
                <Route path="/commercial/recurring" element={<ProtectedRoute><Layout><RecurringPage /></Layout></ProtectedRoute>} />

                {/* Financial Routes */}
                <Route path="/finance/overview" element={<ProtectedRoute><Layout><FinancialOverview /></Layout></ProtectedRoute>} />
                <Route path="/finance/transactions" element={<ProtectedRoute><Layout><FinancialTransactions /></Layout></ProtectedRoute>} />
                <Route path="/finance/accounts" element={<ProtectedRoute><Layout><FinancialAccounts /></Layout></ProtectedRoute>} />
                <Route path="/finance/categories" element={<ProtectedRoute><Layout><FinancialCategories /></Layout></ProtectedRoute>} />
                <Route path="/finance/cards" element={<ProtectedRoute><Layout><FinancialCards /></Layout></ProtectedRoute>} />
                <Route path="/finance/reports" element={<ProtectedRoute><Layout><FinancialReports /></Layout></ProtectedRoute>} />

                <Route path="/settings" element={<ProtectedRoute><Layout><SettingsPage /></Layout></ProtectedRoute>} />

                {/* SUPER ADMIN ROUTES */}
                <Route path="/super-admin/dashboard" element={<ProtectedRoute><Layout><SuperAdminDashboard /></Layout></ProtectedRoute>} />
                <Route path="/super-admin/users" element={<ProtectedRoute><Layout><SuperAdminUsers /></Layout></ProtectedRoute>} />
                <Route path="/super-admin/admins" element={<ProtectedRoute><Layout><SuperAdminAdmins /></Layout></ProtectedRoute>} />
                <Route path="/super-admin/plans" element={<ProtectedRoute><Layout><SuperAdminPlans /></Layout></ProtectedRoute>} />
                
                {/* Legacy redirect */}
                <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />

                <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Router>
            </ThemeProvider>
        </TenantProvider>
      </RBACProvider>
    </AuthProvider>
  );
};

export default App;
