import { describe, expect, it } from "vitest";
import { detectSourceLanguage, resolveOutputLanguage } from "./ai-language";

describe("exam output language", () => {
  it("follows an Arabic source when source language is selected", () => {
    expect(resolveOutputLanguage("source", "هذا نص عربي عن قوانين الحركة" )).toBe("ar");
  });

  it("follows an English source when source language is selected", () => {
    expect(detectSourceLanguage("Photosynthesis converts light energy into chemical energy.")).toBe("en");
  });

  it("allows an explicit language to override the source language", () => {
    expect(resolveOutputLanguage("en", "هذا نص عربي عن قوانين الحركة")).toBe("en");
  });
});