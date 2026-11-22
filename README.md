# Windrose Prow for Metis

> Part of **[the Windrose Suite](https://www.webpresencecare.com/windrose/)**: WordPress for networks of sites, private by default, multilingual if you want it, free for everyone. Each Windrose plugin and theme works on its own.

A child theme of **Metis** (WordPress's flagship theme, https://github.com/WordPress/metis) for the Windrose Suite.

> **Warning: Metis is still in development.** It has no release yet and changes almost every day. Its color names, its Dark Mode switch or its styles can change at any time, and this theme may then show the wrong colors until I adapt it. A check runs on every push and fails as soon as Metis renames something it relies on. Use it to try things out; for a live site, wait until Metis is released.

- Requires WordPress 7.2, PHP 8.4 and the Metis theme. Works on single sites and networks, with or without the Windrose plugins.
- Metis itself is never modified: `style.css`, `theme.json`, `functions.php`, `styles/*.json`.

## What it does

Every Windrose Prow theme gives its parent the same color names, the ones Ipsum and Twenty Twenty-Five share, so a style or a pattern made for one fits them all.

**The adapter.** Metis names its colors `theme-1` to `theme-12`. This theme's palette holds the six common names, and `functions.php` adds CSS (site and editor) that makes Metis's names follow them:

| Metis | Follows |
|---|---|
| `theme-1` | `base`: page background |
| `theme-2` | `accent-3` Strong Contrast: body and strong text |
| `theme-3` | `contrast`: softer text |
| `theme-4` | `accent-5` Surface |
| `theme-5` | `base` at 75 %, calculated |
| `theme-6` | raised surface: `settings.custom.prow.raised` of the style, or `base` a little lighter |
| `theme-7` to `theme-12` | soft accents: `settings.custom.prow.soft-1` to `soft-6` of the style, or the hue of `accent-1` turned in steps of 60 degrees and mixed into `base` |

`accent-1` (Accent) and `accent-6` (Border) are for patterns made in the common names; Metis's own templates do not use them. Metis's twelve gradients are built from its color names, so they follow too. The color pickers list the common names, not Metis's twelve.

**Light and dark.** Metis's Dark Mode switch (any Group with the class `metis-mode-toggle`) swaps the site's colors for those of its Cimmeria style. Here it shows the **other scheme of the site's own style**: dark for a light style, light for a dark one. The other scheme is kept as twin colors in the palette, in Windrose Livery's format (`windrose-livery-dark-<slug>` or `windrose-livery-light-<slug>`), so a style made with Livery's Style Mermaid works with the switch as it is, and the twins can be edited in the Site Editor (Styles, Colors, Palette). The other scheme's raised surface and soft accents are `settings.custom.prow.dark-raised`, `dark-soft-1`... (or `light-`). A style without twins gets a neutral dark set. How: Metis lets a child replace `metis_mode_toggle_colors()`.

**Styles.** Metis's default palette and its six variations (Aeaea, Aeolia, Cimmeria, Ismarus, Ithaca, Ogygia), each in the common names with its other scheme, replace Metis's own (a child's variation file replaces the parent's of the same name; a style in Metis's names would bypass the adapter). Plus Open Sea, as in Windrose Prow for Ipsum, with six soft accents.

## Building the styles

`theme.json` and `styles/*.json` are written by `node bin/build-styles.mjs` and committed. It needs two clones next to this one: `../metis` (the source of Metis's palettes) and `../windrose-livery` (its `makeTwins` calculates the other scheme and checks contrast). Sources of our own styles: `src/*.json` (six colors, `raised`, six `soft`). In a converted Metis style the Accent is Metis's first soft accent moved, same hue, until it reaches 4.5 to 1 on the background.

`node bin/check-metis.mjs` (`--remote` for GitHub) fails when Metis renames its colors or gradients or changes its switch. CI runs it on every push: when it fails, fetch Metis, adapt the map in `functions.php` and `bin/build-styles.mjs`, build again.

## Development

- Tests: Playwright (`tests/e2e/prow-metis.spec.mjs`) on a WordPress network with WP-CLI, Metis and this theme installed (environment variables `WINDROSE_E2E_HOST`, the network's host, default `localhost`; `WINDROSE_E2E_USER`, a network administrator, default `admin`), on a throwaway site `/prow-metis-e2e/`, deleted at the end.
- PHPCS with the WordPress coding standards (`phpcs.xml.dist`) and PHPStan level 8 with the WordPress stubs (`phpstan.neon.dist`).
- CI (`.github/workflows/ci.yml`): php -l on PHP 8.4 and 8.5, core's theme.json schema, theme header, Metis's names, zip build. Release (`release.yml`): tag `vX.Y.Z` builds `windrose-prow-metis.zip` (`bin/build-zip.sh`).

## Status

Releases are on this repository's GitHub releases page. For now, update the theme by hand from there. A wordpress.org version may come later, after independent reviews.

## Security

Please report vulnerabilities privately, never in a public issue: see [SECURITY.md](SECURITY.md).

## Contributing

Reviews, tests and issues are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).

## How this code is written

I write this theme with Claude Code (Anthropic's AI coding assistant): I design each feature, test it on real sites and review every release. Commits written with Claude say so in a `Co-Authored-By` line. Human review is especially welcome.
