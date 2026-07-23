/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Star, User } from "lucide-react";
import { cachedFetch } from "@/lib/apiCache";
import { t } from "@/lib/i18n";

interface PageProps {
  params: Promise<{ id: string }>;
}

const ALL_ROLES = "__all__";

/** TMDB job names are English; translate the common ones and fall back to the raw job. */
function roleLabel(role: string) {
  const key = `person.roles.${role}`;
  const translated = t(key);
  return translated === key ? role : translated;
}

export default function PersonPage({ params }: PageProps) {
  const { id } = use(params);

  const [person, setPerson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>(ALL_ROLES);

  useEffect(() => {
    async function loadPerson() {
      try {
        setLoading(true);
        const data = await cachedFetch(`person-${id}`, async () => {
          const res = await fetch(`/api/tmdb/person?id=${id}`);
          const json = await res.json();
          // A failed lookup must not get cached for a week — throw so the catch below
          // renders the not-found state and the next visit retries.
          if (!json?.id) throw new Error("Person not found");
          return json;
        });
        setPerson(data);
      } catch (err) {
        console.error("Failed to load person:", err);
        setPerson(null);
      } finally {
        setLoading(false);
      }
    }
    loadPerson();
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-yellow-600 border-t-transparent" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="max-w-md mx-auto my-20 px-6 text-center">
        <h2 className="text-xl font-bold">{t("person.notFoundTitle")}</h2>
        <p className="text-sm text-zinc-500 mt-2">{t("person.notFoundBody")}</p>
        <Link href="/discover" className="inline-block mt-4 text-yellow-600 font-semibold hover:underline text-sm">
          {t("person.backToDiscover")}
        </Link>
      </div>
    );
  }

  const credits: any[] = person.credits || [];

  // Roles this person actually has, most-credited first, so the chips reflect what
  // they're really known for rather than a fixed job list.
  const roleCounts = new Map<string, number>();
  credits.forEach((c) => roleCounts.set(c.role, (roleCounts.get(c.role) || 0) + 1));
  const roles = [...roleCounts.entries()].sort((a, b) => b[1] - a[1]);

  // Unfiltered view dedupes titles the person is credited on more than once
  // (e.g. wrote and directed); a role filter keeps every matching credit.
  const visible =
    selectedRole === ALL_ROLES
      ? credits.filter(
          (c, idx) => credits.findIndex((o) => o.media_type === c.media_type && o.id === c.id) === idx
        )
      : credits.filter((c) => c.role === selectedRole);

  const formatYear = (value?: string) => String(value || "").match(/\d{4}/)?.[0] || "";

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 flex-1 flex flex-col">
      <Link
        href="/discover"
        className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors mb-6 self-start"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("person.backToDiscover")}
      </Link>

      {/* Person header */}
      <section className="flex flex-col sm:flex-row gap-6 items-center sm:items-start mb-10">
        <div className="relative h-32 w-32 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0">
          {person.profile_path ? (
            <Image src={person.profile_path} alt={person.name} fill className="object-cover" unoptimized />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
              <User className="h-10 w-10" />
            </div>
          )}
        </div>
        <div className="text-center sm:text-left space-y-2 flex-1">
          <h1 className="text-3xl font-black tracking-tight">{person.name}</h1>
          {person.known_for_department && (
            <p className="text-xs font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">
              {roleLabel(person.known_for_department)}
            </p>
          )}
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("person.creditsCount", { count: credits.length })}
          </p>
          {person.biography && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-4 max-w-2xl pt-1">
              {person.biography}
            </p>
          )}
        </div>
      </section>

      {/* Role filter */}
      {roles.length > 0 && (
        <div className="mb-8">
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
            {t("person.filterByRole")}
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedRole(ALL_ROLES)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                selectedRole === ALL_ROLES
                  ? "bg-yellow-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {t("person.allRoles")}
            </button>
            {roles.map(([role, count]) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  selectedRole === role
                    ? "bg-yellow-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {roleLabel(role)} ({count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Credits grid */}
      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500 py-10 text-center">{t("person.noCredits")}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {visible.map((credit, idx) => (
            <Link
              key={`${credit.media_type}-${credit.id}-${credit.role}-${idx}`}
              href={`/media/${credit.media_type}/${credit.id}`}
              className="group flex flex-col bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="relative aspect-2/3 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <Image
                  src={credit.poster_path}
                  alt={credit.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                />
                <div className="absolute top-2 right-2 bg-zinc-950/80 backdrop-blur-md text-white font-bold text-xxs px-2 py-0.5 rounded shadow">
                  {t(`mediaType.${credit.media_type}`).toUpperCase()}
                </div>
                {credit.vote_average > 0 && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-zinc-950/80 backdrop-blur-sm text-yellow-400 text-xs font-bold px-1.5 py-0.5 rounded">
                    <Star className="h-3 w-3 fill-current" />
                    {credit.vote_average.toFixed(1)}
                  </div>
                )}
              </div>
              <div className="p-3.5 flex-1 flex flex-col justify-between">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50 line-clamp-1 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                  {credit.title}
                </h3>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-bold uppercase tracking-wider line-clamp-1">
                    {roleLabel(credit.role)}
                  </span>
                  <span className="text-xxs text-zinc-400 font-semibold shrink-0">
                    {formatYear(credit.release_date)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
