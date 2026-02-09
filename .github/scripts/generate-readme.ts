import { writeFileSync } from "fs";

const OWNER = "lucasilverentand";
const ORG = "seventwo-studio";

interface Repo {
  name: string;
  description: string | null;
  html_url: string;
  fork: boolean;
  pushed_at: string;
}

async function fetchPublicRepos(
  owner: string,
  type: "users" | "orgs"
): Promise<Repo[]> {
  const repos: Repo[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://api.github.com/${type}/${owner}/repos?per_page=100&sort=pushed&direction=desc&type=public&page=${page}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          ...(process.env.GH_TOKEN && {
            Authorization: `Bearer ${process.env.GH_TOKEN}`,
          }),
        },
      }
    );

    const data: Repo[] = await res.json();
    if (data.length === 0) break;
    repos.push(...data.filter((r) => !r.fork));
    if (data.length < 100) break;
    page++;
  }

  return repos.sort(
    (a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime()
  );
}

function formatRepoList(repos: Repo[], owner: string): string {
  return repos
    .filter((r) => r.name !== owner && !r.name.startsWith("."))
    .map((r) =>
      r.description
        ? `- [**${r.name}**](${r.html_url}) — ${r.description}`
        : `- [**${r.name}**](${r.html_url})`
    )
    .join("\n");
}

const [personalRepos, orgRepos] = await Promise.all([
  fetchPublicRepos(OWNER, "users"),
  fetchPublicRepos(ORG, "orgs"),
]);

const readme = `<div align="center">

<img alt="Luca Silverentand — Building apps & websites @seventwo-studio" src="assets/banner-v2.svg" width="100%" />

[![GitHub followers](https://img.shields.io/github/followers/${OWNER}?style=flat&logo=github&label=Followers&color=6E57F7)](https://github.com/${OWNER}?tab=followers)
[![GitHub stars](https://img.shields.io/github/stars/${OWNER}?style=flat&logo=github&label=Stars&color=6E57F7)](https://github.com/${OWNER}?tab=repositories)
[![Profile views](https://komarev.com/ghpvc/?username=${OWNER}&color=6E57F7&style=flat&label=Profile+views)](https://github.com/${OWNER})
[![GitHub sponsors](https://img.shields.io/github/sponsors/${OWNER}?style=flat&logo=githubsponsors&label=Sponsors&color=6E57F7)](https://github.com/sponsors/${OWNER})

[![TypeScript](https://img.shields.io/badge/TypeScript-%233178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-%23000000?style=flat&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Python](https://img.shields.io/badge/Python-%233776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-%23326CE5?style=flat&logo=kubernetes&logoColor=white)](https://kubernetes.io)

[![Instagram](https://img.shields.io/badge/Instagram-%23E4405F?style=flat&logo=instagram&logoColor=white)](https://instagram.com/luca.silverentand)
[![Threads](https://img.shields.io/badge/Threads-%23000000?style=flat&logo=threads&logoColor=white)](https://threads.net/@luca.silverentand)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-%230A66C2?style=flat&logo=linkedin&logoColor=white)](https://linkedin.com/in/lucasilverentand)
[![SevenTwo Studio](https://img.shields.io/badge/seventwo.studio-%236E57F7?style=flat&logo=safari&logoColor=white)](https://seventwo.studio)

</div>

### About Me

- Owner of [@${ORG}](https://github.com/${ORG}) — building apps & websites
- Primary languages: **TypeScript**, **Rust**, **Shell**, **Python**
- Interests: developer tooling, AI workflows, Kubernetes, home automation

### GitHub Stats

<div align="center">

<picture>
<source media="(prefers-color-scheme: dark)" srcset="https://github-readme-stats.vercel.app/api?username=${OWNER}&show_icons=true&theme=tokyonight&hide_border=true&bg_color=00000000" />
<source media="(prefers-color-scheme: light)" srcset="https://github-readme-stats.vercel.app/api?username=${OWNER}&show_icons=true&theme=default&hide_border=true&bg_color=00000000" />
<img alt="GitHub Stats" src="https://github-readme-stats.vercel.app/api?username=${OWNER}&show_icons=true&theme=default&hide_border=true&bg_color=00000000" />
</picture>

<picture>
<source media="(prefers-color-scheme: dark)" srcset="https://github-readme-stats.vercel.app/api/top-langs/?username=${OWNER}&layout=compact&langs_count=8&theme=tokyonight&hide_border=true&bg_color=00000000" />
<source media="(prefers-color-scheme: light)" srcset="https://github-readme-stats.vercel.app/api/top-langs/?username=${OWNER}&layout=compact&langs_count=8&theme=default&hide_border=true&bg_color=00000000" />
<img alt="Top Languages" src="https://github-readme-stats.vercel.app/api/top-langs/?username=${OWNER}&layout=compact&langs_count=8&theme=default&hide_border=true&bg_color=00000000" />
</picture>

<picture>
<source media="(prefers-color-scheme: dark)" srcset="https://streak-stats.demolab.com?user=${OWNER}&theme=tokyonight&hide_border=true&background=00000000" />
<source media="(prefers-color-scheme: light)" srcset="https://streak-stats.demolab.com?user=${OWNER}&theme=default&hide_border=true&background=00000000" />
<img alt="GitHub Streak" src="https://streak-stats.demolab.com?user=${OWNER}&theme=default&hide_border=true&background=00000000" />
</picture>

</div>

### Projects

#### Personal

${formatRepoList(personalRepos, OWNER)}

#### [@${ORG}](https://github.com/${ORG})

${formatRepoList(orgRepos, ORG)}

### Contribution Snake

<div align="center">
<picture>
<source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/${OWNER}/${OWNER}/output/github-snake-dark.svg" />
<source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/${OWNER}/${OWNER}/output/github-snake.svg" />
<img alt="Contribution Snake" src="https://raw.githubusercontent.com/${OWNER}/${OWNER}/output/github-snake.svg" />
</picture>
</div>
`;

writeFileSync("README.md", readme);
console.log(
  `Generated README.md with ${personalRepos.filter((r) => r.name !== OWNER && !r.name.startsWith(".")).length} personal and ${orgRepos.filter((r) => r.name !== ORG && !r.name.startsWith(".")).length} org repos`
);
