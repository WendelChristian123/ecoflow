
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
import { CompanyProvider } from './context/CompanyContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppEnvironmentProvider, useAppEnvironment } from './context/AppEnvironmentContext';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { ProtectedRoute, PermissionRoute } from './components/ProtectedRoute';
import { SettingsPage } from './pages/Settings';
import { LandingPage } from './pages/Landing/LandingPage';
import { CheckoutPage } from './pages/Checkout/CheckoutPage';
import { ReloadPrompt } from './components/ReloadPrompt';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { LayoutSwitch } from './components/LayoutSwitch';
import { AppRoute } from './components/AppRoute';

// Super Admin Pages
import { SuperAdminDashboard } from './pages/SuperAdmin/Dashboard';
import { SuperAdminUsers } from './pages/SuperAdmin/Users';
import { SuperAdminAdmins } from './pages/SuperAdmin/Admins';
import { SuperAdminPlans } from './pages/SuperAdmin/Plans';
import { SuperAdminCompanies } from './pages/SuperAdmin/Companies';

// Financial Pages
import { FinancialOverview } from './pages/finance/Overview';
import { FinancialTransactions } from './pages/finance/Transactions';
import { Loans } from './pages/finance/Loans';
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

// Landing page wrapper — shows Login in App mode, Landing in Web mode
const LandingOrLogin: React.FC = () => {
  const { isApp } = useAppEnvironment();
  if (isApp) return <Navigate to="/login" replace />;
  return <LandingPage />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <CompanyProvider>
        <RBACProvider>
          <ThemeProvider>
            <AppEnvironmentProvider>
              <Router>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<LandingOrLogin />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />

                  {/* Rotas Protegidas */}
                  <Route path="/dashboard" element={<ProtectedRoute><LayoutSwitch><Dashboard /></LayoutSwitch></ProtectedRoute>} />

                  {/* Routines & Execution */}
                  <Route path="/routines/overview" element={<AppRoute><PermissionRoute module="routines" action="view"><LayoutSwitch><RoutinesOverview /></LayoutSwitch></PermissionRoute></AppRoute>} />
                  <Route path="/tasks" element={<PermissionRoute module="routines" action="view"><LayoutSwitch><TasksPage /></LayoutSwitch></PermissionRoute>} />
                  <Route path="/projects" element={<AppRoute><PermissionRoute module="routines" action="view"><LayoutSwitch><ProjectsPage /></LayoutSwitch></PermissionRoute></AppRoute>} />
                  <Route path="/teams" element={<AppRoute><PermissionRoute module="routines" action="view"><LayoutSwitch><TeamsPage /></LayoutSwitch></PermissionRoute></AppRoute>} />
                  <Route path="/agenda" element={<PermissionRoute module="routines" action="view"><LayoutSwitch><AgendaPage /></LayoutSwitch></PermissionRoute>} />

                  {/* Commercial Routes */}
                  <Route path="/commercial/overview" element={<PermissionRoute module="commercial" action="view"><LayoutSwitch><CommercialOverview /></LayoutSwitch></PermissionRoute>} />
                  <Route path="/commercial/contacts" element={<AppRoute><PermissionRoute module="commercial" action="view"><LayoutSwitch><ContactsPage /></LayoutSwitch></PermissionRoute></AppRoute>} />
                  <Route path="/commercial/catalog" element={<AppRoute><PermissionRoute module="commercial" action="view"><LayoutSwitch><CatalogPage /></LayoutSwitch></PermissionRoute></AppRoute>} />
                  <Route path="/commercial/quotes" element={<PermissionRoute module="commercial" action="view"><LayoutSwitch><QuotesPage /></LayoutSwitch></PermissionRoute>} />
                  <Route path="/commercial/recurring" element={<AppRoute><PermissionRoute module="commercial" action="view"><LayoutSwitch><RecurringPage /></LayoutSwitch></PermissionRoute></AppRoute>} />

                  {/* Financial Routes */}
                  <Route path="/finance/overview" element={<PermissionRoute module="finance" action="view"><LayoutSwitch><FinancialOverview /></LayoutSwitch></PermissionRoute>} />
                  <Route path="/finance/transactions" element={<PermissionRoute module="finance" action="view"><LayoutSwitch><FinancialTransactions /></LayoutSwitch></PermissionRoute>} />
                  <Route path="/finance/loans" element={<PermissionRoute module="finance" action="view"><LayoutSwitch><Loans /></LayoutSwitch></PermissionRoute>} />
                  <Route path="/finance/accounts" element={<PermissionRoute module="finance" action="view"><LayoutSwitch><FinancialAccounts /></LayoutSwitch></PermissionRoute>} />
                  <Route path="/finance/categories" element={<AppRoute><PermissionRoute module="finance" action="view"><LayoutSwitch><FinancialCategories /></LayoutSwitch></PermissionRoute></AppRoute>} />
                  <Route path="/finance/cards" element={<AppRoute><PermissionRoute module="finance" action="view"><LayoutSwitch><FinancialCards /></LayoutSwitch></PermissionRoute></AppRoute>} />
                  <Route path="/finance/reports" element={<AppRoute><PermissionRoute module="reports" action="view"><LayoutSwitch><FinancialReports /></LayoutSwitch></PermissionRoute></AppRoute>} />

                  <Route path="/settings" element={<ProtectedRoute><LayoutSwitch><SettingsPage /></LayoutSwitch></ProtectedRoute>} />

                  {/* SUPER ADMIN ROUTES — always Web-only */}
                  <Route path="/super-admin/dashboard" element={<AppRoute><ProtectedRoute><LayoutSwitch><SuperAdminDashboard /></LayoutSwitch></ProtectedRoute></AppRoute>} />
                  <Route path="/super-admin/users" element={<AppRoute><ProtectedRoute><LayoutSwitch><SuperAdminUsers /></LayoutSwitch></ProtectedRoute></AppRoute>} />
                  <Route path="/super-admin/admins" element={<AppRoute><ProtectedRoute><LayoutSwitch><SuperAdminAdmins /></LayoutSwitch></ProtectedRoute></AppRoute>} />
                  <Route path="/super-admin/plans" element={<AppRoute><ProtectedRoute><LayoutSwitch><SuperAdminPlans /></LayoutSwitch></ProtectedRoute></AppRoute>} />
                  <Route path="/super-admin/companies" element={<AppRoute><ProtectedRoute><LayoutSwitch><SuperAdminCompanies /></LayoutSwitch></ProtectedRoute></AppRoute>} />

                  {/* Legacy redirect */}
                  <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <ReloadPrompt />
                <PwaInstallPrompt />
              </Router>
            </AppEnvironmentProvider>
          </ThemeProvider>
        </RBACProvider>
      </CompanyProvider>
    </AuthProvider>
  );
};

export default App;
