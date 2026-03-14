import path from 'path';
import fs from 'fs/promises';
import { joinSegments } from '@quartz-community/types';
import { escapeHTML, simplifySlug } from '@quartz-community/utils';
import { toHtml } from 'hast-util-to-html';

// src/emitter.ts
var defaultOptions = {
  enableSiteMap: true,
  enableRSS: true,
  rssLimit: 10,
  rssFullHtml: false,
  rssSlug: "index",
  includeEmptyFiles: true,
  rssRecentNotesText: "Recent notes",
  rssLastFewNotesText: (count) => `Last ${count} notes`
};
var write = async (args) => {
  const pathToPage = joinSegments(args.ctx.argv.output, args.slug + args.ext);
  const dir = path.dirname(pathToPage);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(pathToPage, args.content);
  return pathToPage;
};
function getDate(cfg, data) {
  return data.dates?.[cfg.defaultDateType ?? "modified"];
}
function generateSiteMap(cfg, idx) {
  const base = cfg.baseUrl ?? "";
  const createURLEntry = (slug, content) => `<url>
    <loc>https://${joinSegments(base, encodeURI(slug))}</loc>
    ${content.date && `<lastmod>${content.date.toISOString()}</lastmod>`}
  </url>`;
  const urls = Array.from(idx).map(([slug, content]) => createURLEntry(simplifySlug(slug), content)).join("");
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`;
}
function generateRSSFeed(cfg, idx, options, limit) {
  const base = cfg.baseUrl ?? "";
  const pageTitle = cfg.pageTitle ?? "";
  const recentNotesText = options.rssRecentNotesText ?? "Recent notes";
  const lastFewNotesText = options.rssLastFewNotesText ?? ((count) => `Last ${count} notes`);
  const createURLEntry = (slug, content) => `<item>
    <title>${escapeHTML(content.title)}</title>
    <link>https://${joinSegments(base, encodeURI(slug))}</link>
    <guid>https://${joinSegments(base, encodeURI(slug))}</guid>
    <description><![CDATA[ ${content.richContent ?? content.description} ]]></description>
    <pubDate>${content.date?.toUTCString()}</pubDate>
  </item>`;
  const items = Array.from(idx).sort(([_, f1], [__, f2]) => {
    if (f1.date && f2.date) {
      return f2.date.getTime() - f1.date.getTime();
    } else if (f1.date && !f2.date) {
      return -1;
    } else if (!f1.date && f2.date) {
      return 1;
    }
    return f1.title.localeCompare(f2.title);
  }).map(([slug, content]) => createURLEntry(simplifySlug(slug), content)).slice(0, limit ?? idx.size).join("");
  const description = `${limit ? lastFewNotesText(limit) : recentNotesText} on ${escapeHTML(pageTitle)}`;
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
    <channel>
      <title>${escapeHTML(pageTitle)}</title>
      <link>https://${base}</link>
      <description>${description}</description>
      <generator>Quartz -- quartz.jzhao.xyz</generator>
      ${items}
    </channel>
  </rss>`;
}
var ContentIndex = (opts) => {
  const options = { ...defaultOptions, ...opts };
  const emitAll = async (ctx, content) => {
    const cfg = ctx.cfg.configuration;
    const linkIndex = /* @__PURE__ */ new Map();
    for (const [tree, file] of content) {
      const data = file.data ?? {};
      const slug = data.slug;
      const date = getDate(cfg, data) ?? /* @__PURE__ */ new Date();
      const text = data.text;
      if (options.includeEmptyFiles || text && text !== "") {
        const frontmatter = data.frontmatter ?? {};
        linkIndex.set(slug, {
          slug,
          filePath: data.relativePath,
          title: frontmatter.title ?? "",
          links: data.links ?? [],
          tags: frontmatter.tags ?? [],
          content: text ?? "",
          richContent: options.rssFullHtml ? escapeHTML(toHtml(tree, { allowDangerousHtml: true })) : void 0,
          date,
          description: data.description ?? ""
        });
      }
    }
    const outputs = [];
    if (options.enableSiteMap) {
      outputs.push(
        await write({
          ctx,
          content: generateSiteMap(cfg, linkIndex),
          slug: "sitemap",
          ext: ".xml"
        })
      );
    }
    if (options.enableRSS) {
      outputs.push(
        await write({
          ctx,
          content: generateRSSFeed(cfg, linkIndex, options, options.rssLimit),
          slug: options.rssSlug ?? "index",
          ext: ".xml"
        })
      );
    }
    const fp = joinSegments("static", "contentIndex");
    const simplifiedIndex = Object.fromEntries(
      Array.from(linkIndex).map(([slug, content2]) => {
        delete content2.description;
        delete content2.date;
        return [slug, content2];
      })
    );
    outputs.push(
      await write({
        ctx,
        content: JSON.stringify(simplifiedIndex),
        slug: fp,
        ext: ".json"
      })
    );
    return outputs;
  };
  return {
    name: "ContentIndex",
    emit: (ctx, content) => emitAll(ctx, content),
    // RSS auto-discovery link tag should be added via a component plugin or manually in the layout.
    partialEmit: (ctx, content) => emitAll(ctx, content)
  };
};

export { ContentIndex };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map