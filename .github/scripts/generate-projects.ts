import { readFileSync, writeFileSync } from "fs";

const OWNERS: { name: string; type: "users" | "orgs" }[] = [
  { name: "lucasilverentand", type: "users" },
  { name: "seventwo-studio", type: "orgs" },
  { name: "silverswarm", type: "orgs" },
  { name: "ellie-languages", type: "orgs" },
  { name: "blankly-app", type: "orgs" },
];

const headers: Record<string, string> = {
  Accept: "application/vnd.github+json",
  ...(process.env.GH_TOKEN && {
    Authorization: `Bearer ${process.env.GH_TOKEN}`,
  }),
};

interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  fork: boolean;
  archived: boolean;
  language: string | null;
  stargazers_count: number;
  topics: string[];
  license: { spdx_id: string } | null;
  created_at: string;
  pushed_at: string;
}

interface PublishedApp {
  name: string;
  description: string;
  owner: string;
  platform: string;
  app_store_url?: string;
  play_store_url?: string;
  homepage?: string;
  topics?: string[];
}

interface Tags {
  type: string[];
  framework: string[];
  language: string[];
}

interface Project {
  name: string;
  description: string | null;
  owner: string;
  url: string | null;
  homepage: string | null;
  language: string | null;
  stars: number;
  topics: string[];
  license: string | null;
  created_at: string | null;
  updated_at: string | null;
  source: "github" | "published-app";
  platform?: string;
  app_store_url?: string;
  play_store_url?: string;
  tags: Tags;
}

async function fetchPublicRepos(
  owner: string,
  type: "users" | "orgs"
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/${type}/${owner}/repos?per_page=100&sort=pushed&direction=desc&type=public&page=${page}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      if (res.status === 404) return [];
      console.warn(`Failed to fetch ${type}/${owner}: ${res.status}`);
      return repos;
    }

    const data: GitHubRepo[] = await res.json();
    if (data.length === 0) break;
    repos.push(...data.filter((r) => !r.fork && !r.archived));
    if (data.length < 100) break;
    page++;
  }

  return repos;
}

// Fetch public repos from all owners in parallel
const reposByOwner = await Promise.all(
  OWNERS.map(async ({ name, type }) => ({
    owner: name,
    repos: await fetchPublicRepos(name, type),
  }))
);

// Load tag overrides
const tagOverrides: Record<string, Tags> = JSON.parse(
  readFileSync("project-tags.json", "utf-8")
);

function resolveTags(key: string, apiLanguage: string | null): Tags {
  const override = tagOverrides[key];
  if (override) return override;

  // Fallback: derive language from GitHub API
  return {
    type: [],
    framework: [],
    language: apiLanguage ? [apiLanguage.toLowerCase()] : [],
  };
}

// Convert GitHub repos to projects
const ghProjects: Project[] = reposByOwner.flatMap(({ repos }) =>
  repos.map((r) => {
    const key = `${r.full_name.split("/")[0]}/${r.name}`;
    return {
      name: r.name,
      description: r.description,
      owner: r.full_name.split("/")[0],
      url: r.html_url,
      homepage: r.homepage || null,
      language: r.language,
      stars: r.stargazers_count,
      topics: r.topics ?? [],
      license: r.license?.spdx_id ?? null,
      created_at: r.created_at,
      updated_at: r.pushed_at,
      source: "github" as const,
      tags: resolveTags(key, r.language),
    };
  })
);

// Load published apps (private repos with public products)
const publishedApps: PublishedApp[] = JSON.parse(
  readFileSync("published-apps.json", "utf-8")
);

const appProjects: Project[] = publishedApps.map((app) => {
  const key = `${app.owner}/${app.name}`;
  return {
    name: app.name,
    description: app.description,
    owner: app.owner,
    url: null,
    homepage: app.homepage ?? null,
    language: null,
    stars: 0,
    topics: app.topics ?? [],
    license: null,
    created_at: null,
    updated_at: null,
    source: "published-app" as const,
    platform: app.platform,
    ...(app.app_store_url && { app_store_url: app.app_store_url }),
    ...(app.play_store_url && { play_store_url: app.play_store_url }),
    tags: resolveTags(key, null),
  };
});

// Merge — published apps override any matching GitHub repo by name+owner
const appKeys = new Set(appProjects.map((a) => `${a.owner}/${a.name}`));
const merged = [
  ...ghProjects.filter((p) => !appKeys.has(`${p.owner}/${p.name}`)),
  ...appProjects,
];

// Sort by most recently updated, with published apps first
merged.sort((a, b) => {
  if (a.source !== b.source) return a.source === "published-app" ? -1 : 1;
  const da = a.updated_at ? new Date(a.updated_at).getTime() : 0;
  const db = b.updated_at ? new Date(b.updated_at).getTime() : 0;
  return db - da;
});

// Validation
const warnings: string[] = [];
for (const project of merged) {
  const key = `${project.owner}/${project.name}`;
  if (!tagOverrides[key]) {
    warnings.push(`${key}: no entry in project-tags.json`);
  } else {
    if (project.tags.type.length === 0) {
      warnings.push(`${key}: missing type tag`);
    }
    if (project.tags.language.length === 0) {
      warnings.push(`${key}: missing language tag`);
    }
  }
}

if (warnings.length > 0) {
  console.warn(`\n⚠ Tag validation warnings (${warnings.length}):`);
  for (const w of warnings) console.warn(`  - ${w}`);
}

const strict = process.argv.includes("--strict");
if (strict && warnings.length > 0) {
  console.error("\n✗ Strict mode: failing due to tag warnings");
  process.exit(1);
}

const output = {
  generated_at: new Date().toISOString(),
  count: merged.length,
  projects: merged,
};

writeFileSync("projects.json", JSON.stringify(output, null, 2));
console.log(
  `\nGenerated projects.json with ${ghProjects.length} public repos and ${appProjects.length} published apps (${merged.length} total)`
);
