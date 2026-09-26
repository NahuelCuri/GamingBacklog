import { describe, expect, it, vi } from "vitest";
import { applyLookup, cleanIsbn, fromGoogleBooks, fromOpenLibrary, lookupIsbn } from "./lookup";

describe("ISBN lookup", () => {
  it("cleans ISBNs", () => {
    expect(cleanIsbn("978-0-7564-0407-9")).toBe("9780756404079");
    expect(cleanIsbn(" 0-306-40615-x ")).toBe("030640615x");
  });

  it("normalizes catalog records", () => {
    expect(
      fromOpenLibrary({ title: "T", authors: [{ name: "A" }, { name: "B" }], number_of_pages: 662, publish_date: "March 27, 2007", subjects: [{ name: "Fantasy" }, { name: " " }] }),
    ).toEqual({ title: "T", author: "A, B", pages: 662, pubYear: "2007", genres: ["Fantasy"] });
    expect(fromGoogleBooks({ title: "T", subtitle: "S", authors: ["A"], pageCount: 10, publishedDate: "2011-01", categories: ["X", "Y", "Z", "W", "V"] })).toEqual({
      title: "T: S", author: "A", pages: 10, pubYear: "2011", genres: ["X", "Y", "Z", "W"],
    });
  });

  it("falls through sources until one has a title", async () => {
    const fetchFn = vi.fn(async (url: string) => ({
      json: async () =>
        url.includes("api/books") ? {} : url.includes("googleapis") ? { items: [{ volumeInfo: { title: "Found" } }] } : { docs: [] },
    }));
    expect((await lookupIsbn("123", fetchFn))?.title).toBe("Found");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("returns null when no catalog knows it, even if a source throws", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes("googleapis")) throw new Error("offline");
      return { json: async () => ({}) };
    });
    expect(await lookupIsbn("123", fetchFn)).toBeNull();
  });

  it("fills the draft through the config map, merging lists", () => {
    const fill = { title: "title", author: "author", pages: "pages", genres: "genres" };
    const { draft, filled } = applyLookup({ title: "", genres: ["fantasy"] }, fill, { title: "T", author: "", pages: 5, genres: ["Fantasy", "Epic"] });
    expect(draft).toEqual({ title: "T", pages: 5, genres: ["fantasy", "Epic"] });
    expect(filled).toEqual(["title", "pages", "genres"]);
  });
});
