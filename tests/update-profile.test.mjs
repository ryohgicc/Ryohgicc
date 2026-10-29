import assert from "node:assert/strict";
import { buildSnapshot } from "../scripts/update-profile.mjs";

const user = {
  public_repos: 24,
  followers: 7
};

const repos = [
  { stargazers_count: 27, language: "JavaScript" },
  { stargazers_count: 6, language: "TypeScript" },
  { stargazers_count: 3, language: "JavaScript" },
  { stargazers_count: 1, language: "HTML" },
  { stargazers_count: 1, language: null },
  { stargazers_count: 0, language: "Swift" }
];

assert.equal(
  buildSnapshot(user, repos),
  [
    "| Public repos | Stars earned | Followers | Main languages |",
    "| ---: | ---: | ---: | --- |",
    "| 24 | 38 | 7 | JavaScript, HTML, Swift, TypeScript |"
  ].join("\n")
);
