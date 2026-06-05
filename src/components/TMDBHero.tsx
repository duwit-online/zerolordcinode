import { Play, Plus, Search, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { TMDBMovie, getBackdropUrl, getTitle, getYear, getMediaType } from "@/lib/tmdb";

interface TMDBHeroProps {
  item: TMDBMovie;
}

const TMDBHero = ({ item }: TMDBHeroProps) => {
  const navigate = useNavigate();
  const mediaType = getMediaType(item);
  const rating = (item.vote_average ?? 0).toFixed(1);

  return (
    <section className="relative h-[88vh] min-h-[620px] overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={getBackdropUrl(item.backdrop_path)}
          alt={getTitle(item)}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/10" />
      </div>

      {/* Top-right icons (mobile) */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-4 md:hidden">
        <button
          onClick={() => navigate("/search")}
          className="text-foreground/90 hover:text-foreground"
          aria-label="Search"
        >
          <Search size={22} strokeWidth={1.5} />
        </button>
        <button
          onClick={() => navigate("/profile")}
          className="text-foreground/90 hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell size={22} strokeWidth={1.5} />
        </button>
      </div>

      <div className="relative h-full flex items-end pb-10 px-5 md:px-12 max-w-[1600px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="w-full max-w-2xl"
        >
          <div className="flex items-center gap-3 mb-5 text-foreground/80">
            <span className="px-3 py-1.5 rounded-md bg-background/70 backdrop-blur-sm text-[11px] font-semibold tracking-[0.18em] uppercase">
              Featured
            </span>
            <span className="text-sm tracking-wide">
              {getYear(item)} <span className="mx-1.5 opacity-60">•</span> {mediaType === "tv" ? "TV" : "MOVIE"} <span className="mx-1.5 opacity-60">•</span> {rating} ★
            </span>
          </div>

          <h1 className="font-display italic font-medium text-[44px] md:text-7xl leading-[1.02] mb-6 tracking-tight">
            {getTitle(item)}
          </h1>

          <p className="text-foreground/75 text-base md:text-lg leading-relaxed mb-8 max-w-xl line-clamp-3">
            {item.overview}
          </p>

          <div className="grid grid-cols-2 gap-3 md:flex md:items-center md:gap-4 max-w-xl">
            <button
              onClick={() => navigate(`/watch/${mediaType}/${item.id}`)}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-white text-black font-semibold text-sm tracking-wider uppercase hover:bg-white/90 transition-colors"
            >
              <Play size={16} className="fill-black" />
              Play Trailer
            </button>
            <button
              onClick={() => navigate(`/details/${mediaType}/${item.id}`)}
              className="flex items-center justify-center gap-2 px-6 py-4 border border-foreground/40 text-foreground font-semibold text-sm tracking-wider uppercase hover:bg-foreground/5 transition-colors"
            >
              <Plus size={16} />
              Add Watchlist
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TMDBHero;
