import { expect, it } from "vitest";

import { getFileList } from "../src/index.js";

it("getFileList", () => {
  expect(getFileList("./src")).toMatchSnapshot();
});
