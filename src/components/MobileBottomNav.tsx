import { useState } from "react";
import { Home, Tv, Search, Bookmark, Download, User, Shield, LogOut, Menu, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const items = [
  { icon: Home, label: "Home", path: "/app" },
  { icon: Tv, label: "TV", path: "/tv" },
  { icon: Search, label: "Search", path: "/search" },
  { icon: Bookmark, label: "Watchlist", path: "/watchlist" },
  { icon: Download, label: "Downloads", path: "/downloads" },
  { icon: User, label: "Profile", path: "/profile" },
];

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, signOut, user } = useAuth();
  const [open, setOpen] = useState(false);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="md:hidden">
      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-[60] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center active:scale-95 transition-transform"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? <X size={24} /> : <Menu size={24} />}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.nav
              initial={{ x: -80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -80, opacity: 0 }}
              transition={{ type: "spring", damping: 24, stiffness: 260 }}
              className="fixed top-0 left-0 bottom-0 z-50 w-20 bg-background/95 backdrop-blur-md border-r border-border/40 flex flex-col items-center py-6"
            >
              <div className="flex-1 flex flex-col items-center gap-3 mt-2">
                {items.map(({ icon: Icon, label, path }) => {
                  const active = location.pathname === path;
                  return (
                    <button
                      key={path}
                      onClick={() => go(path)}
                      aria-label={label}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                        active
                          ? "bg-primary text-primary-foreground shadow-[0_0_24px_-4px_hsl(var(--primary))]"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon size={22} strokeWidth={active ? 2.2 : 1.6} />
                    </button>
                  );
                })}
                {isAdmin && (
                  <button
                    onClick={() => go("/admin")}
                    aria-label="Admin"
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                      location.pathname === "/admin"
                        ? "bg-primary text-primary-foreground"
                        : "text-primary hover:text-primary/80"
                    }`}
                  >
                    <Shield size={22} strokeWidth={1.8} />
                  </button>
                )}
              </div>

              {user && (
                <button
                  onClick={async () => {
                    setOpen(false);
                    await signOut();
                    navigate("/");
                  }}
                  aria-label="Sign out"
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <LogOut size={22} strokeWidth={1.6} />
                </button>
              )}
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileBottomNav;
