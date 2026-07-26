import { useEffect } from 'react';

const DEFAULT_TITLE = 'FileLinker';
const DEFAULT_DESCRIPTION = 'Upload a file, get a clean shareable link instantly, preview it online, and set links to expire automatically.';
const DEFAULT_IMAGE = '/social-preview.svg';

function ensureMeta(name, attr = 'name') {
  const selector = `meta[${attr}="${name}"]`;
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(attr, name);
    document.head.appendChild(node);
  }
  return node;
}

function ensureLink(rel) {
  let node = document.head.querySelector(`link[rel="${rel}"]`);
  if (!node) {
    node = document.createElement('link');
    node.setAttribute('rel', rel);
    document.head.appendChild(node);
  }
  return node;
}

function absoluteUrl(path = '/') {
  if (typeof window === 'undefined') return path;
  return new URL(path, window.location.origin).toString();
}

export default function Seo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  noindex = false,
  schema,
}) {
  useEffect(() => {
    const canonical = absoluteUrl(path);
    const image = absoluteUrl(DEFAULT_IMAGE);
    const fullTitle = title === DEFAULT_TITLE ? title : `${title} | ${DEFAULT_TITLE}`;

    document.title = fullTitle;

    ensureMeta('description').setAttribute('content', description);
    ensureMeta('robots').setAttribute('content', noindex ? 'noindex, nofollow' : 'index, follow');

    ensureMeta('og:type', 'property').setAttribute('content', 'website');
    ensureMeta('og:title', 'property').setAttribute('content', fullTitle);
    ensureMeta('og:description', 'property').setAttribute('content', description);
    ensureMeta('og:url', 'property').setAttribute('content', canonical);
    ensureMeta('og:image', 'property').setAttribute('content', image);
    ensureMeta('og:site_name', 'property').setAttribute('content', DEFAULT_TITLE);

    ensureMeta('twitter:card', 'name').setAttribute('content', 'summary_large_image');
    ensureMeta('twitter:title', 'name').setAttribute('content', fullTitle);
    ensureMeta('twitter:description', 'name').setAttribute('content', description);
    ensureMeta('twitter:image', 'name').setAttribute('content', image);

    ensureLink('canonical').setAttribute('href', canonical);

    let schemaNode = document.head.querySelector('script[data-seo-schema="true"]');
    if (!schemaNode) {
      schemaNode = document.createElement('script');
      schemaNode.type = 'application/ld+json';
      schemaNode.setAttribute('data-seo-schema', 'true');
      document.head.appendChild(schemaNode);
    }
    schemaNode.textContent = schema ? JSON.stringify(schema) : '';

    return () => {
      if (schemaNode && !schema) {
        schemaNode.textContent = '';
      }
    };
  }, [description, noindex, path, schema, title]);

  return null;
}
