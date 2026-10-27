import { describe, expect, it } from "vitest";
import { CARPA, dentroDeCarpa, lugarLibre, seSuperponen, sillas, type Pieza } from "./plano";

const redonda = (x: number, y: number, d = 1.6): Pieza => ({ x, y, ancho: d, largo: d, forma: "redonda" });
const rect = (x: number, y: number, ancho: number, largo: number): Pieza => ({ x, y, ancho, largo, forma: "rectangular" });

describe("dentroDeCarpa", () => {
  it("frena la pieza en el borde", () => {
    expect(dentroDeCarpa(redonda(-3, 20))).toEqual({ x: 0.8, y: CARPA.largo - 0.8 });
  });
  it("redondea a 10 cm", () => {
    expect(dentroDeCarpa(redonda(3.14159, 5.06))).toEqual({ x: 3.1, y: 5.1 });
  });
});

describe("seSuperponen", () => {
  it("dos redondas", () => {
    expect(seSuperponen(redonda(2, 2), redonda(3, 2))).toBe(true);
    expect(seSuperponen(redonda(2, 2), redonda(4, 2))).toBe(false);
  });
  it("redonda contra la pista", () => {
    const pista = rect(5, 7.5, 5, 5);
    expect(seSuperponen(redonda(2.6, 7.5), pista)).toBe(true);
    expect(seSuperponen(redonda(1.5, 7.5), pista)).toBe(false);
  });
  it("dos rectángulos", () => {
    expect(seSuperponen(rect(2, 2, 2, 1), rect(3.5, 2, 2, 1))).toBe(true);
    expect(seSuperponen(rect(2, 2, 2, 1), rect(2, 3.2, 2, 1))).toBe(false);
  });
});

describe("sillas", () => {
  it("reparte las sillas alrededor de una redonda", () => {
    const s = sillas(redonda(0, 0), 8);
    expect(s).toHaveLength(8);
    for (const p of s) expect(Math.hypot(p.x, p.y)).toBeCloseTo(1.1);
  });
  it("en una rectangular van a los dos lados largos", () => {
    const s = sillas(rect(0, 0, 3, 1), 6);
    expect(s.filter((p) => p.y < 0)).toHaveLength(3);
    expect(s.filter((p) => p.y > 0)).toHaveLength(3);
  });
});

describe("lugarLibre", () => {
  it("encuentra un hueco que no pise lo que hay", () => {
    const pista = rect(5, 7.5, 5, 5);
    const p = lugarLibre({ ancho: 1.6, largo: 1.6, forma: "redonda" }, [pista, redonda(0.8, 0.8)])!;
    expect(seSuperponen({ ...p, ancho: 1.6, largo: 1.6, forma: "redonda" }, pista)).toBe(false);
    expect(p).not.toEqual({ x: 0.8, y: 0.8 });
  });
});
