
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
import { ProtectedRoute, PermissionRoute } from './components/ProtectedRoute';
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
import { CommercialOverview } from './pages/commercial/Overview';


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
                <Route path="/routines/overview" element={<PermissionRoute module="routines" action="view"><Layout><RoutinesOverview /></Layout></PermissionRoute>} />
                <Route path="/tasks" element={<PermissionRoute module="routines" action="view"><Layout><TasksPage /></Layout></PermissionRoute>} />
                <Route path="/projects" element={<PermissionRoute module="routines" action="view"><Layout><ProjectsPage /></Layout></PermissionRoute>} />
                <Route path="/teams" element={<PermissionRoute module="routines" action="view"><Layout><TeamsPage /></Layout></PermissionRoute>} />
                <Route path="/agenda" element={<PermissionRoute module="routines" action="view"><Layout><AgendaPage /></Layout></PermissionRoute>} />

                {/* Commercial Routes */}
                <Route path="/commercial/overview" element={<PermissionRoute module="commercial" action="view"><Layout><CommercialOverview /></Layout></PermissionRoute>} />
                <Route path="/commercial/contacts" element={<PermissionRoute module="commercial" action="view"><Layout><ContactsPage /></Layout></PermissionRoute>} />
                <Route path="/commercial/catalog" element={<PermissionRoute module="commercial" action="view"><Layout><CatalogPage /></Layout></PermissionRoute>} />
                <Route path="/commercial/quotes" element={<PermissionRoute module="commercial" action="view"><Layout><QuotesPage /></Layout></PermissionRoute>} />
                <Route path="/commercial/recurring" element={<PermissionRoute module="commercial" action="view"><Layout><RecurringPage /></Layout></PermissionRoute>} />

                {/* Financial Routes */}
                <Route path="/finance/overview" element={<PermissionRoute module="finance" action="view"><Layout><FinancialOverview /></Layout></PermissionRoute>} />
                <Route path="/finance/transactions" element={<PermissionRoute module="finance" action="view"><Layout><FinancialTransactions /></Layout></PermissionRoute>} />
                <Route path="/finance/accounts" element={<PermissionRoute module="finance" action="view"><Layout><FinancialAccounts /></Layout></PermissionRoute>} />
                <Route path="/finance/categories" element={<PermissionRoute module="finance" action="view"><Layout><FinancialCategories /></Layout></PermissionRoute>} />
                <Route path="/finance/cards" element={<PermissionRoute module="finance" action="view"><Layout><FinancialCards /></Layout></PermissionRoute>} />
                <Route path="/finance/reports" element={<PermissionRoute module="reports" action="view"><Layout><FinancialReports /></Layout></PermissionRoute>} />

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
