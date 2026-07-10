import { useTrending, usePopularMovies, useTopRatedMovies, useNowPlaying, useUpcoming, usePopularTV, useTopRatedTV, useAiringToday, useMoviesByGenre, useTVByGenre } from "@/hooks/useTMDB";
import TMDBRow from "@/components/TMDBRow";
import TMDBHero from "@/components/TMDBHero";
import AdBanner from "@/components/AdBanner";
import ContinueWatchingRow from "@/components/ContinueWatchingRow";
import { Skeleton } from "@/components/ui/skeleton";

const GENRE_ROWS = [
  { id: "Action", title: "💥 Action" },
  { id: "Comedy", title: "😂 Comedy" },
  { id: "Horror", title: "👻 Horror" },
  { id: "Romance", title: "💕 Romance" },
  { id: "Science Fiction", title: "🚀 Sci-Fi" },
  { id: "Thriller", title: "🔪 Thriller" },
  { id: "Animation", title: "🎨 Animation" },
  { id: "Documentary", title: "📖 Documentary" },
];

const TV_GENRE_ROWS = [
  { id: "Action", title: "🗡️ Action TV" },
  { id: "Comedy", title: "😄 Comedy Series" },
  { id: "Drama", title: "🎭 Drama Series" },
  { id: "Science Fiction", title: "🪐 Sci-Fi Series" },
];

const GenreRow = ({ genreId, title }: { genreId: string; title: string }) => {
  const { data } = useMoviesByGenre(genreId);
  if (!data?.results?.length) return null;
  return <TMDBRow title={title} items={data.results} variant="default" />;
};

const TVGenreRow = ({ genreId, title }: { genreId: string; title: string }) => {
  const { data } = useTVByGenre(genreId);
  if (!data?.results?.length) return null;
  return <TMDBRow title={title} items={data.results} variant="default" />;
};

const Index = () => {
  const { data: mostWatched } = useTrending("day");
  const { data: trending } = useTrending();
  const { data: popular } = usePopularMovies();
  const { data: topRated } = useTopRatedMovies();
  const { data: nowPlaying } = useNowPlaying();
  const { data: upcoming } = useUpcoming();
  const { data: popularTV } = usePopularTV();
  const { data: topRatedTV } = useTopRatedTV();
  const { data: airingToday } = useAiringToday();

  const heroItem = trending?.results?.[0];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {heroItem ? <TMDBHero item={heroItem} /> : <Skeleton className="h-[70vh] w-full" />}

      <div className="relative -mt-12 z-10">
        <AdBanner placement="homepage" className="mx-4 md:mx-8 mb-4" />
        <ContinueWatchingRow />
        <TMDBRow title="👀 Most Watched" items={mostWatched?.results || []} variant="default" />
        <TMDBRow title="🔥 Trending Now" items={trending?.results || []} variant="default" />
        <TMDBRow title="🎬 Popular Movies" items={popular?.results || []} variant="wide" />
        <TMDBRow title="🆕 Recently Added Movies" items={nowPlaying?.results || []} variant="default" />
        <AdBanner placement="homepage" className="mx-4 md:mx-8 mb-4" />
        <TMDBRow title="⭐ Top Rated Movies" items={topRated?.results || []} variant="tall" />
        <TMDBRow title="📅 Coming Soon" items={upcoming?.results || []} variant="wide" />
        <TMDBRow title="📺 Popular TV Shows" items={popularTV?.results || []} variant="default" />
        <AdBanner placement="homepage" className="mx-4 md:mx-8 mb-4" />
        <TMDBRow title="🏆 Top Rated TV" items={topRatedTV?.results || []} variant="tall" />
        <TMDBRow title="🆕 Recently Added Series" items={airingToday?.results || []} variant="default" />

        {GENRE_ROWS.map(g => (
          <GenreRow key={g.id} genreId={g.id} title={g.title} />
        ))}

        {TV_GENRE_ROWS.map(g => (
          <TVGenreRow key={g.id} genreId={g.id} title={g.title} />
        ))}
      </div>
    </div>
  );
};

export default Index;
