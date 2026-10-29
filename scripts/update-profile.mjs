import fs from "node:fs/promises";

const configPath = new URL("../profile.config.json", import.meta.url);
const readmePath = new URL("../README.md", import.meta.url);

const config = JSON.parse(await fs.readFile(configPath, "utf8"));
let readme = await fs.readFile(readmePath, "utf8");

const username = process.env.GITHUB_USERNAME || config.githubUsername;
const token = process.env.GITHUB_TOKEN;

if (!username || username === "YOUR_GITHUB_USERNAME") {
  console.log("Skipping activity update: set githubUsername in profile.config.json first.");
  process.exit(0);
}

const escapeMarkdown = (value = "") =>
  String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");

const eventLabels = {
  PushEvent: "Pushed updates to",
  PullRequestEvent: "Worked on a pull request in",
  IssuesEvent: "Updated an issue in",
  CreateEvent: "Created something in",
  ForkEvent: "Forked",
  WatchEvent: "Starred",
  ReleaseEvent: "Published a release in",
  PullRequestReviewEvent: "Reviewed a pull request in"
};

async function fetchJson(url) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "profile-readme-updater"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function fetchEvents() {
  return fetchJson(`https://api.github.com/users/${username}/events/public?per_page=20`);
}

async function fetchProfileSnapshot() {
  const [user, repos] = await Promise.all([
    fetchJson(`https://api.github.com/users/${username}`),
    fetchJson(`https://api.github.com/users/${username}/repos?per_page=100`)
  ]);

  return buildSnapshot(user, repos);
}

export function buildActivity(events) {
  const visibleEvents = events
    .filter((event) => event?.repo?.name)
    .slice(0, 5);

  if (visibleEvents.length === 0) {
    return "_No recent public activity found._";
  }

  return visibleEvents
    .map((event) => {
      const repo = escapeMarkdown(event.repo.name);
      const label = eventLabels[event.type] || "Updated";
      return `- ${label} [${repo}](https://github.com/${event.repo.name})`;
    })
    .join("\n");
}

export function buildSnapshot(user, repos) {
  const stars = repos.reduce((total, repo) => total + (repo.stargazers_count || 0), 0);
  const languageCounts = new Map();

  for (const repo of repos) {
    if (!repo.language) continue;
    languageCounts.set(repo.language, (languageCounts.get(repo.language) || 0) + 1);
  }

  const languages = [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([language]) => language)
    .join(", ");

  return [
    "| Public repos | Stars earned | Followers | Main languages |",
    "| ---: | ---: | ---: | --- |",
    `| ${user.public_repos || 0} | ${stars} | ${user.followers || 0} | ${languages || "None yet"} |`
  ].join("\n");
}

function replaceBetweenMarkers(source, marker, value) {
  const start = `<!--${marker}:start-->`;
  const end = `<!--${marker}:end-->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);

  if (!pattern.test(source)) {
    throw new Error(`Could not find ${marker} markers in README.md`);
  }

  return source.replace(pattern, `${start}\n${value}\n${end}`);
}

function personalize(source) {
  const focusText = config.focus?.length
    ? config.focus.join(", ")
    : "software that is useful and maintainable";

  const techText = (config.tech || []).map((item) => `\`${item}\``).join(" ");
  const featuredText = (config.featuredProjects || [])
    .map((project) => `- [${escapeMarkdown(project.name)}](${project.url}) - ${escapeMarkdown(project.description)}`)
    .join("\n");

  return source
    .replace(/^## Hi, I'm .+$/m, `## Hi, I'm ${config.name || username}`)
    .replace(/^Developer building practical, reliable software\.$/m, config.headline || "Developer building practical, reliable software.")
    .replace(
      /^- Currently focused on .+$/m,
      `- Currently focused on ${focusText}`
    )
    .replace(/^`TypeScript` `React` `Node.js` `Python` `PostgreSQL` `Docker`$/m, techText)
    .replace(/- \[Project One\][\s\S]*?- \[Project Two\].+$/m, featuredText)
    .replaceAll("YOUR_GITHUB_USERNAME", username)
    .replace(
      /^- Website: .+$/m,
      config.website ? `- Website: ${config.website}` : "- Website: _add your link in `profile.config.json`_"
    )
    .replace(
      /^- Email: .+$/m,
      config.email ? `- Email: ${config.email}` : "- Email: _add your email in `profile.config.json`_"
    );
}

export async function updateProfileReadme() {
  readme = personalize(readme);
  const [events, snapshot] = await Promise.all([
    fetchEvents(),
    fetchProfileSnapshot()
  ]);
  readme = replaceBetweenMarkers(readme, "SNAPSHOT", snapshot);
  readme = replaceBetweenMarkers(readme, "RECENT_ACTIVITY", buildActivity(events));
  await fs.writeFile(readmePath, `${readme.trim()}\n`);
  console.log("README.md updated.");
}

try {
  if (import.meta.url === `file://${process.argv[1]}`) {
    await updateProfileReadme();
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}
