/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser, signOutUser, isSupabaseConfigured, supabase, UserProfile } from "@/lib/db";
import { Film, LogOut, User, Tv, Bookmark, LogIn } from "lucide-react";
import { t } from "@/lib/i18n";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const fetchUser = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  };

  useEffect(() => {
    fetchUser();

    if (isSupabaseConfigured && supabase) {
      // Reactive: fires on sign-in/sign-out/token refresh, no polling needed.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(
          session?.user
            ? {
              id: session.user.id,
              email: session.user.email || "",
              username: session.user.user_metadata?.username || session.user.email?.split("@")[0],
            }
            : null
        );
      });

      return () => subscription.unsubscribe();
    }

    // Mock mode has no realtime auth events, so fall back to polling local storage.
    const handleStorageChange = () => {
      fetchUser();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", handleStorageChange);

    const interval = setInterval(fetchUser, 2000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const handleSignOut = async () => {
    await signOutUser();
    setUser(null);
    setIsDropdownOpen(false);
    router.push("/");
  };

  const navItems = [
    { name: t("nav.discover"), href: "/discover", icon: Tv },
    { name: t("nav.watchlist"), href: "/watchlist", icon: Bookmark },
  ];

  return (
    <nav className="border-b border-zinc-200 bg-white/80 dark:border-zinc-200/10 dark:bg-black/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo Section */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <Film className="h-6 w-6 text-yellow-600 dark:text-yellow-400 group-hover:rotate-12 transition-transform duration-200" />
              <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-yellow-600 to-amber-500 bg-clip-text text-transparent dark:from-yellow-400 dark:to-amber-400">
                PioMDB
              </span>
            </Link>

            {/* Navigation Links */}
            <div className="hidden md:flex ml-10 space-x-4">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-yellow-50 text-yellow-700 dark:bg-zinc-900 dark:text-yellow-400"
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User Section */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 transition-colors text-sm"
                >
                  <User className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {user.username || user.email}
                  </span>
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-lg py-1 z-50">
                    <Link
                      href="/profile"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
                    >
                      <User className="h-4 w-4" />
                      {t("nav.myProfile")}
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors text-left border-t border-zinc-100 dark:border-zinc-900 mt-1"
                    >
                      <LogOut className="h-4 w-4" />
                      {t("nav.signOut")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-yellow-600 hover:bg-yellow-500 shadow-md shadow-yellow-200 dark:shadow-none transition-all"
                >
                  <LogIn className="h-4 w-4" />
                  {t("nav.signIn")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav Links */}
      <div className="md:hidden flex border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-4 py-2 justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-semibold ${
                isActive
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
