import { describe, it, expect, beforeEach } from "vitest";
import { setKEK, getKEK, clearKEK, isUnlocked } from "../key-store";

describe("key-store", () => {
  beforeEach(() => {
    clearKEK();
  });

  it("isUnlocked returns false when empty", () => {
    expect(isUnlocked()).toBe(false);
  });

  it("getKEK returns null when empty", () => {
    expect(getKEK()).toBeNull();
  });

  it("setKEK and getKEK", async () => {
    const key = await crypto.subtle.importKey(
      "raw",
      crypto.getRandomValues(new Uint8Array(32)),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );

    setKEK(key);
    expect(getKEK()).toBe(key);
    expect(isUnlocked()).toBe(true);
  });

  it("clearKEK removes reference", async () => {
    const key = await crypto.subtle.importKey(
      "raw",
      crypto.getRandomValues(new Uint8Array(32)),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );

    setKEK(key);
    expect(isUnlocked()).toBe(true);

    clearKEK();
    expect(getKEK()).toBeNull();
    expect(isUnlocked()).toBe(false);
  });
});
