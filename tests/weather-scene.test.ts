import { describe, expect, it } from "vitest";
import { weatherScene } from "@/lib/weather/scene";

describe("weather scenes", () => {
  it("maps a clear day and a clear night apart", () => {
    expect(weatherScene(0, true)).toBe("sun");
    expect(weatherScene(1, false)).toBe("night");
  });

  it("keeps overcast, rain, storms, fog, and snow distinct", () => {
    expect(weatherScene(3, true)).toBe("cloud");
    expect(weatherScene(2, true)).toBe("cloud");
    expect(weatherScene(2, false)).toBe("night");
    expect(weatherScene(61, true)).toBe("rain");
    expect(weatherScene(51, false)).toBe("rain");
    expect(weatherScene(95, true)).toBe("storm");
    expect(weatherScene(45, true)).toBe("fog");
    expect(weatherScene(73, false)).toBe("snow");
    expect(weatherScene(85, true)).toBe("snow");
  });
});
