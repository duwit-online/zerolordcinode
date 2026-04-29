import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { usePresence } from "@/hooks/usePresence";
import Navbar from "@/components/Navbar";
import MobileBottomNav from "@/components/MobileBottomNav";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Details from "./pages/Details";
import Watch from "./pages/Watch";
import Search from "./pages/Search";
import Movies from "./pages/Movies";
import TVShows from "./pages/TVShows";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Collections from "./pages/Collections";
import Watchlist from "./pages/Watchlist";
import Premium from "./pages/Premium";
import Checkout from "./pages/Checkout";
import AffiliatesDashboard from "./pages/AffiliatesDashboard";
import ResetPassword from "./pages/ResetPassword";
import StaticPage from "./pages/StaticPage";
import Downloads from "./pages/Downloads";
import NotFound from "./pages/NotFound";
import TrialBanner from "@/components/TrialBanner";
import TrialWelcomeModal from "@/components/TrialWelcomeModal";

const queryClient = new QueryClient();

const AppLayout = () => {
  usePresence();
  const location = useLocation();
  const isLanding = location.pathname === "/";
  const isAuth = location.pathname === "/auth";
  const hideNav = isLanding || isAuth;

  return (
    <>
      {!hideNav && <TrialBanner />}
      {!hideNav && <Navbar />}
      {!hideNav && <MobileBottomNav />}
      {!hideNav && <TrialWelcomeModal />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Index />} />
        <Route path="/index" element={<Index />} />
        <Route path="/details/:type/:id" element={<Details />} />
        <Route path="/watch/:type/:id" element={<Watch />} />
        <Route path="/search" element={<Search />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/tv" element={<TVShows />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/premium" element={<Premium />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/affiliates" element={<AffiliatesDashboard />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/p/:slug" element={<StaticPage />} />
        <Route path="/downloads" element={<Downloads />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
