import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { DefaultLayout } from "./components/DefaultLayout";
import { useInternals, usePlaylist, useSlots } from "./context";
import { PlaylistProvider } from "./PlaylistProvider";
import type { PlaylistHandle, PlaylistProps, Theme } from "./types";

/** The complete player. Children, if given, replace the default layout inside the themed root. */
export const Playlist = forwardRef<PlaylistHandle, PlaylistProps>(function Playlist(
  { titleAs, artworkPosition = "left", controls, maxHeight, className, style, theme = "system", children, ...providerProps },
  ref,
) {
  return (
    <PlaylistProvider {...providerProps} theme={theme} handleRef={ref}>
      <PlaylistRoot
        theme={theme}
        artworkPosition={artworkPosition}
        maxHeight={maxHeight}
        className={className}
        style={style}
      >
        {children ?? <DefaultLayout titleAs={titleAs} controls={controls} />}
      </PlaylistRoot>
    </PlaylistProvider>
  );
});

function PlaylistRoot({
  theme,
  artworkPosition,
  maxHeight,
  className,
  style,
  children,
}: {
  theme: Theme;
  artworkPosition: "left" | "right";
  maxHeight?: number | string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { title } = usePlaylist();
  const { labels } = useInternals();
  const slot = useSlots();
  return (
    <section
      {...slot("root", "surfbort", { className, style: maxHeight != null ? { maxHeight, ...style } : style })}
      data-theme={theme === "system" ? undefined : theme}
      data-artwork-position={artworkPosition}
      data-max-height={maxHeight != null || undefined}
      aria-label={typeof title === "string" && title ? title : labels.player}
    >
      {children}
    </section>
  );
}
