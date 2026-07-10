/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadTVTimeTrackedMedia } from "./tvtime";

// Mock data representing TMDB results for movies and TV shows
export interface TMDBMedia {
  id: number;
  title: string;
  original_title?: string;
  name?: string; // TV Shows use 'name' instead of 'title'
  media_type: 'movie' | 'tv';
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  genres: { id: number; name: string }[];
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  tagline?: string;
  credits?: {
    cast: { id: number; name: string; character: string; profile_path: string | null }[];
    crew: { id: number; name: string; job: string; department: string }[];
  };
}

export const MOCK_MOVIES: TMDBMedia[] = [
  {
    id: 101,
    title: "Inception",
    media_type: "movie",
    overview: "Cobb, a skilled thief who commits corporate espionage by infiltrating the sub-conscious of his targets, is offered a chance to regain his old life as payment for a task considered to be impossible: \"inception\", the implantation of another person's idea into a target's subcontinent.",
    poster_path: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=400&auto=format&fit=crop",
    backdrop_path: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop",
    release_date: "2010-07-16",
    vote_average: 8.4,
    vote_count: 34212,
    genres: [{ id: 28, name: "Action" }, { id: 878, name: "Science Fiction" }, { id: 12, name: "Adventure" }],
    runtime: 148,
    status: "Released",
    tagline: "Your mind is the scene of the crime.",
    credits: {
      cast: [
        { id: 1, name: "Leonardo DiCaprio", character: "Cobb", profile_path: null },
        { id: 2, name: "Joseph Gordon-Levitt", character: "Arthur", profile_path: null },
        { id: 3, name: "Elliot Page", character: "Ariadne", profile_path: null },
        { id: 4, name: "Tom Hardy", character: "Eames", profile_path: null },
      ],
      crew: [
        { id: 5, name: "Christopher Nolan", job: "Director", department: "Directing" },
        { id: 5, name: "Christopher Nolan", job: "Writer", department: "Writing" },
      ]
    }
  },
  {
    id: 102,
    title: "The Dark Knight",
    media_type: "movie",
    overview: "Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets. The partnership proves to be effective, but they soon find themselves prey to a reign of chaos unleashed by a rising criminal mastermind known to the terrified citizens of Gotham as the Joker.",
    poster_path: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=400&auto=format&fit=crop",
    backdrop_path: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=1200&auto=format&fit=crop",
    release_date: "2008-07-16",
    vote_average: 8.5,
    vote_count: 31000,
    genres: [{ id: 28, name: "Action" }, { id: 80, name: "Crime" }, { id: 18, name: "Drama" }],
    runtime: 152,
    status: "Released",
    tagline: "Why So Serious?",
    credits: {
      cast: [
        { id: 11, name: "Christian Bale", character: "Bruce Wayne / Batman", profile_path: null },
        { id: 12, name: "Heath Ledger", character: "Joker", profile_path: null },
        { id: 13, name: "Gary Oldman", character: "Jim Gordon", profile_path: null },
        { id: 14, name: "Michael Caine", character: "Alfred Pennyworth", profile_path: null },
      ],
      crew: [
        { id: 5, name: "Christopher Nolan", job: "Director", department: "Directing" },
        { id: 5, name: "Christopher Nolan", job: "Writer", department: "Writing" },
      ]
    }
  },
  {
    id: 103,
    title: "Interstellar",
    media_type: "movie",
    overview: "The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.",
    poster_path: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=400&auto=format&fit=crop",
    backdrop_path: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop",
    release_date: "2014-11-05",
    vote_average: 8.4,
    vote_count: 32000,
    genres: [{ id: 12, name: "Adventure" }, { id: 18, name: "Drama" }, { id: 878, name: "Science Fiction" }],
    runtime: 169,
    status: "Released",
    tagline: "Mankind was born on Earth. It was never meant to die here.",
    credits: {
      cast: [
        { id: 21, name: "Matthew McConaughey", character: "Cooper", profile_path: null },
        { id: 22, name: "Anne Hathaway", character: "Brand", profile_path: null },
        { id: 23, name: "Jessica Chastain", character: "Murph", profile_path: null },
        { id: 24, name: "Michael Caine", character: "Professor Brand", profile_path: null },
      ],
      crew: [
        { id: 5, name: "Christopher Nolan", job: "Director", department: "Directing" },
        { id: 25, name: "Jonathan Nolan", job: "Writer", department: "Writing" },
      ]
    }
  },
  {
    id: 104,
    title: "Spider-Man: Into the Spider-Verse",
    media_type: "movie",
    overview: "Struggling to fit in after being bitten by a radioactive spider, Brooklyn teen Miles Morales discovers the multi-dimensional Spider-Verse, where he must team up with different alternate-universe Spider-Heroes to stop a threat to all reality.",
    poster_path: "https://images.unsplash.com/photo-1635805737707-575885ab0820?q=80&w=400&auto=format&fit=crop",
    backdrop_path: "https://images.unsplash.com/photo-1635805737707-575885ab0820?q=80&w=1200&auto=format&fit=crop",
    release_date: "2018-12-07",
    vote_average: 8.4,
    vote_count: 14000,
    genres: [{ id: 16, name: "Animation" }, { id: 28, name: "Action" }, { id: 12, name: "Adventure" }],
    runtime: 117,
    status: "Released",
    tagline: "More than one wears the mask.",
    credits: {
      cast: [
        { id: 31, name: "Shameik Moore", character: "Miles Morales / Spider-Man", profile_path: null },
        { id: 32, name: "Jake Johnson", character: "Peter B. Parker / Spider-Man", profile_path: null },
        { id: 33, name: "Hailee Steinfeld", character: "Gwen Stacy / Spider-Woman", profile_path: null },
        { id: 34, name: "Mahershala Ali", character: "Uncle Aaron / Prowler", profile_path: null },
      ],
      crew: [
        { id: 35, name: "Bob Persichetti", job: "Director", department: "Directing" },
        { id: 36, name: "Phil Lord", job: "Writer", department: "Writing" },
      ]
    }
  }
];

export const MOCK_SHOWS: TMDBMedia[] = [
  {
    id: 201,
    name: "Breaking Bad",
    title: "Breaking Bad",
    media_type: "tv",
    overview: "Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of only two years left to live. He becomes filled with a sense of fearlessness and an unrelenting desire to secure his family's financial future at any cost as he enters the dangerous world of drugs and crime.",
    poster_path: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=400&auto=format&fit=crop",
    backdrop_path: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1200&auto=format&fit=crop",
    first_air_date: "2008-01-20",
    vote_average: 8.9,
    vote_count: 12430,
    genres: [{ id: 18, name: "Drama" }, { id: 80, name: "Crime" }],
    number_of_seasons: 5,
    number_of_episodes: 62,
    status: "Ended",
    tagline: "All Hail the King.",
    credits: {
      cast: [
        { id: 41, name: "Bryan Cranston", character: "Walter White", profile_path: null },
        { id: 42, name: "Aaron Paul", character: "Jesse Pinkman", profile_path: null },
        { id: 43, name: "Anna Gunn", character: "Skyler White", profile_path: null },
        { id: 44, name: "Bob Odenkirk", character: "Saul Goodman", profile_path: null },
      ],
      crew: [
        { id: 45, name: "Vince Gilligan", job: "Creator", department: "Directing" },
      ]
    }
  },
  {
    id: 202,
    name: "Stranger Things",
    title: "Stranger Things",
    media_type: "tv",
    overview: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.",
    poster_path: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=400&auto=format&fit=crop",
    backdrop_path: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1200&auto=format&fit=crop",
    first_air_date: "2016-07-15",
    vote_average: 8.6,
    vote_count: 16000,
    genres: [{ id: 18, name: "Drama" }, { id: 10765, name: "Sci-Fi & Fantasy" }, { id: 9648, name: "Mystery" }],
    number_of_seasons: 4,
    number_of_episodes: 34,
    status: "Returning Series",
    tagline: "One Summer Can Change Everything.",
    credits: {
      cast: [
        { id: 51, name: "Millie Bobby Brown", character: "Eleven", profile_path: null },
        { id: 52, name: "Finn Wolfhard", character: "Mike Wheeler", profile_path: null },
        { id: 53, name: "Winona Ryder", character: "Joyce Byers", profile_path: null },
        { id: 54, name: "David Harbour", character: "Jim Hopper", profile_path: null },
      ],
      crew: [
        { id: 55, name: "Matt Duffer", job: "Creator", department: "Directing" },
        { id: 56, name: "Ross Duffer", job: "Creator", department: "Directing" },
      ]
    }
  },
  {
    id: 203,
    name: "Succession",
    title: "Succession",
    media_type: "tv",
    overview: "The Roy family is known for controlling the biggest media and entertainment company in the world. However, their world changes when their father steps down from the company.",
    poster_path: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=400&auto=format&fit=crop",
    backdrop_path: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
    first_air_date: "2018-06-03",
    vote_average: 8.3,
    vote_count: 3200,
    genres: [{ id: 18, name: "Drama" }],
    number_of_seasons: 4,
    number_of_episodes: 39,
    status: "Ended",
    tagline: "Waystar Royco. Quality. Integrity. Respect.",
    credits: {
      cast: [
        { id: 61, name: "Brian Cox", character: "Logan Roy", profile_path: null },
        { id: 62, name: "Jeremy Strong", character: "Kendall Roy", profile_path: null },
        { id: 63, name: "Sarah Snook", character: "Siobhan 'Shiv' Roy", profile_path: null },
        { id: 64, name: "Kieran Culkin", character: "Roman Roy", profile_path: null },
      ],
      crew: [
        { id: 65, name: "Jesse Armstrong", job: "Creator", department: "Writing" },
      ]
    }
  }
];

export const ALL_MOCK_MEDIA = [...MOCK_MOVIES, ...MOCK_SHOWS];

const TMDB_API_URL = "https://api.themoviedb.org/3";

export async function fetchFromTMDB(path: string, params: Record<string, string> = {}) {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    // Return custom mock behaviors based on route
    if (path.includes("/trending/all") || path.includes("/trending/movie") || path.includes("/trending/tv")) {
      return { results: ALL_MOCK_MEDIA };
    }
    if (path.startsWith("/search/")) {
      const query = params.query?.toLowerCase() || "";
      const filtered = ALL_MOCK_MEDIA.filter(item =>
        (item.title && item.title.toLowerCase().includes(query)) ||
        (item.name && item.name.toLowerCase().includes(query)) ||
        item.overview.toLowerCase().includes(query)
      );
      return { results: filtered };
    }
    // Single detail path lookup like /movie/101 or /tv/201
    const parts = path.split("/");
    const type = parts[1] as 'movie' | 'tv';
    const id = parseInt(parts[2], 10);
    const found = ALL_MOCK_MEDIA.find(item => item.id === id && item.media_type === type);
    if (found) return found;

    // Default return first mock or custom empty object
    return ALL_MOCK_MEDIA[0];
  }

  // Real TMDB call
  const queryParams = new URLSearchParams({
    api_key: apiKey,
    append_to_response: "credits",
    ...params,
  });

  const response = await fetch(`${TMDB_API_URL}${path}?${queryParams.toString()}`);
  if (!response.ok) {
    throw new Error(`TMDB fetch failed: ${response.statusText}`);
  }
  return response.json();
}

export async function getTrendingMedia(type: "movie" | "tv" | "all" = "all") {
  try {
    const data = await fetchFromTMDB(`/trending/${type}/week`);
    // Map response structure to generic list
    return (data.results || []).map((item: any) => ({
      id: item.id,
      title: item.title || item.name || "",
      media_type: item.media_type || (type === "all" ? "movie" : type),
      overview: item.overview || "",
      poster_path: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=400&auto=format&fit=crop",
      backdrop_path: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop",
      release_date: item.release_date || item.first_air_date || "",
      vote_average: item.vote_average || 0,
      vote_count: item.vote_count || 0,
    }));
  } catch (error) {
    console.error("Error fetching trending from TMDB:", error);
    // Fallback to mocks
    const baseList = type === "all" ? ALL_MOCK_MEDIA : (type === "movie" ? MOCK_MOVIES : MOCK_SHOWS);
    return baseList;
  }
}

export async function searchMedia(query: string, type: "movie" | "tv" | "all" = "all") {
  if (!query) return [];
  try {
    let results: any[] = [];
    if (type === "all") {
      const movieRes = await fetchFromTMDB("/search/movie", { query });
      const tvRes = await fetchFromTMDB("/search/tv", { query });
      results = [
        ...(movieRes.results || []).map((m: any) => ({ ...m, media_type: "movie" })),
        ...(tvRes.results || []).map((t: any) => ({ ...t, media_type: "tv" }))
      ];
    } else {
      const res = await fetchFromTMDB(`/search/${type}`, { query });
      results = (res.results || []).map((m: any) => ({ ...m, media_type: type }));
    }

    return results.map((item: any) => ({
      id: item.id,
      title: item.title || item.name || "",
      media_type: item.media_type,
      overview: item.overview || "",
      poster_path: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=400&auto=format&fit=crop",
      backdrop_path: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop",
      release_date: item.release_date || item.first_air_date || "",
      vote_average: item.vote_average || 0,
      vote_count: item.vote_count || 0,
    }));
  } catch (error) {
    console.error("Error searching TMDB:", error);
    const baseList = type === "all" ? ALL_MOCK_MEDIA : (type === "movie" ? MOCK_MOVIES : MOCK_SHOWS);
    return baseList.filter(item =>
      (item.title && item.title.toLowerCase().includes(query.toLowerCase())) ||
      (item.name && item.name.toLowerCase().includes(query.toLowerCase()))
    );
  }
}

export async function getMediaDetail(type: "movie" | "tv", id: string | number) {
  const matchedId = parseInt(id as string, 10);
  const apiKey = process.env.TMDB_API_KEY;

  // Let's resolve the actual show's name if we have it in TV Time data
  const tvtimeList = loadTVTimeTrackedMedia("11519429");
  const tvtimeMatched = tvtimeList.find(item => item.media_id === matchedId && item.media_type === type);

  if (apiKey) {
    try {
      let activeId: string | number = id;

      // TV Time TVDB ID lookup on TMDB!
      // If we don't have a direct TMDB ID but a TVDB show name, let's search TMDB by name!
      if (type === "tv" && tvtimeMatched) {
        const searchRes = await fetch(`${TMDB_API_URL}/search/tv?api_key=${apiKey}&query=${encodeURIComponent(tvtimeMatched.title)}`);
        if (searchRes.ok) {
          const searchJson = await searchRes.json();
          if (searchJson.results && searchJson.results.length > 0) {
            activeId = searchJson.results[0].id;
          }
        }
      }

      const data = await fetchFromTMDB(`/${type}/${activeId}`);

      const casts = data.credits?.cast?.slice(0, 10).map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profile_path: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
      })) || [];

      const crews = data.credits?.crew?.filter((c: any) =>
        c.job === "Director" || c.job === "Writer" || c.job === "Creator" || c.job === "Executive Producer"
      ).slice(0, 5).map((c: any) => ({
        id: c.id,
        name: c.name,
        job: c.job,
        department: c.department
      })) || [];

      return {
        id: data.id,
        title: data.title || data.name || "",
        media_type: type,
        overview: data.overview || "",
        poster_path: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=400&auto=format&fit=crop",
        backdrop_path: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop",
        release_date: data.release_date || data.first_air_date || "",
        vote_average: data.vote_average || 0,
        vote_count: data.vote_count || 0,
        genres: data.genres || [],
        runtime: data.runtime || (data.episode_run_time ? data.episode_run_time[0] : null),
        number_of_seasons: data.number_of_seasons || null,
        number_of_episodes: data.number_of_episodes || null,
        status: data.status || "Unknown",
        tagline: data.tagline || "",
        credits: {
          cast: casts,
          crew: crews
        }
      };
    } catch (err) {
      console.error("TMDB real metadata lookup error, falling back to mocks:", err);
    }
  }

  // Search in mock data or TV Time metadata
  const found = ALL_MOCK_MEDIA.find(item => item.id === matchedId && item.media_type === type);
  if (found) {
    return {
      ...found,
      title: found.title || found.name || "",
      release_date: found.release_date || found.first_air_date || "",
      credits: found.credits || { cast: [], crew: [] }
    };
  }

  // Fallback to TV Time mock item details
  if (tvtimeMatched) {
    return {
      id: matchedId,
      title: tvtimeMatched.title,
      media_type: "tv" as const,
      overview: `Imported show from TV Time. Status: ${tvtimeMatched.status}. Configure your TMDB API Key in environment variables to load true posters, ratings, cast, and summaries dynamically.`,
      poster_path: tvtimeMatched.poster_path,
      backdrop_path: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1200&auto=format&fit=crop",
      release_date: "2017-02-22",
      vote_average: 8.5,
      vote_count: 450,
      genres: [{ id: 1, name: "Drama" }, { id: 2, name: "TV Time Import" }],
      runtime: 45,
      status: "Released",
      tagline: "Your favorite TV Time series.",
      credits: { cast: [], crew: [] }
    };
  }

  // Default empty state or first mock
  return {
    id: matchedId,
    title: type === "movie" ? "Mock Movie Title" : "Mock TV Show",
    media_type: type,
    overview: "Could not fetch details. Running in offline/mock fallback mode.",
    poster_path: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=400&auto=format&fit=crop",
    backdrop_path: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop",
    release_date: "2025-01-01",
    vote_average: 7.5,
    vote_count: 100,
    genres: [{ id: 1, name: "Drama" }],
    runtime: 120,
    status: "Released",
    tagline: "This is a fallback tagline.",
    credits: { cast: [], crew: [] }
  };
}
