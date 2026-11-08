import { describe, expect, it, vi } from "vitest";

import { getMusicListJSON } from "../src/generator/music.js";
import { ValidationError } from "../src/helpers/validation.js";
import type { MusicList } from "../src/schema/index.js";
import { checkMusicList } from "../src/schema/index.js";

const validList: MusicList = [
  {
    src: "https://example.com/song.mp3",
    cover: "https://example.com/cover.png",
    title: "校歌",
    singer: "合唱团",
  },
];

const invalidList = [{ ...validList[0], title: 1 }] as unknown as MusicList;

describe(checkMusicList, () => {
  it("location 默认为空字符串，合法数据返回空列表", () => {
    expect(checkMusicList(validList)).toStrictEqual([]);
  });

  it("location 默认为空字符串，非法数据仍返回带中文描述的问题", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const issues = checkMusicList(invalidList);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatch(/^ 发现非法音乐数据/u);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("传入 location 时问题中保留位置信息", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const issues = checkMusicList(invalidList, "music/list");

      expect(issues[0]).toContain("music/list 发现非法音乐数据");
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe(getMusicListJSON, () => {
  it("默认校验并抛出 ValidationError", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(() => getMusicListJSON(invalidList, "music/list")).toThrow(ValidationError);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("check 为 false 时跳过校验，调用方仍可拿到原数据", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(getMusicListJSON(invalidList, "music/list", false)).toBe(invalidList);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
