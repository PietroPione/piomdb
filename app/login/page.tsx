/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, signUpUser, signInUser } from "@/lib/db";
import { Film, Mail, Lock, User, Check } from "lucide-react";
import { t } from "@/lib/i18n";

export default function Login() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // If user already logged in, push to Dashboard/Profile page
    async function checkUser() {
      const u = await getCurrentUser();
      if (u) router.push("/profile");
    }
    checkUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { user: newUser, error: signUpErr } = await signUpUser(email, password, username);
        if (signUpErr) {
          setError(signUpErr);
        } else {
          setSuccess(true);
          setTimeout(() => {
            router.push("/profile");
          }, 1500);
        }
      } else {
        const { user: existingUser, error: signInErr } = await signInUser(email, password);
        if (signInErr) {
          setError(signInErr);
        } else {
          router.push("/profile");
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-zinc-50 dark:bg-black/40">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex justify-center">
          <div className="h-12 w-12 bg-yellow-600 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <Film className="h-6 w-6 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
          {isSignUp ? t("login.createAccount") : t("login.welcomeBack")}
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400 font-medium">
          {t("login.or")}{" "}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="font-bold text-yellow-600 dark:text-yellow-400 hover:underline"
          >
            {isSignUp ? t("login.signInExisting") : t("login.registerNew")}
          </button>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-zinc-900 py-8 px-4 shadow-sm sm:rounded-3xl sm:px-10 border border-zinc-200/60 dark:border-zinc-800">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/20 p-4 border border-red-200/50 dark:border-red-900/30">
                <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {success && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-4 border border-emerald-200/50 dark:border-emerald-900/30 flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {t("login.registeredSuccess")}
                </p>
              </div>
            )}

            {isSignUp && (
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  {t("login.username")}
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-zinc-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("login.usernamePlaceholder")}
                    className="block w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 text-base"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                {t("login.email")}
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("login.emailPlaceholder")}
                  className="block w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 text-base"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                {t("login.password")}
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  className="block w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 text-base"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-yellow-600 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-all disabled:opacity-50"
              >
                {loading ? t("login.pleaseWait") : isSignUp ? t("login.signUp") : t("login.signIn")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
