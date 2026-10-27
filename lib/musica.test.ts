import { describe, expect, it } from "vitest";
import { playlistId, youtubeUrl } from "./musica";

describe("playlistId", () => {
  it("lee links y URIs de Spotify", () => {
    const id = "37i9dQZF1DXcBWIGoYBM5M";
    expect(playlistId(`https://open.spotify.com/playlist/${id}?si=abc123`)).toBe(id);
    expect(playlistId(`https://open.spotify.com/intl-es/playlist/${id}`)).toBe(id);
    expect(playlistId(`spotify:playlist:${id}`)).toBe(id);
  });
  it("rechaza lo que no es una playlist", () => {
    expect(playlistId("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")).toBeNull();
  });
});

describe("youtubeUrl", () => {
  it("arma la búsqueda con título y artista", () => {
    expect(youtubeUrl("Golden Hour", "JVKE")).toBe("https://www.youtube.com/results?search_query=Golden%20Hour%20JVKE");
  });
});
