// Map a storefront URL to the template + resources Shopify would render.
import { stripHtml } from './util.mjs';

function truncate(s, n = 160) {
  const t = stripHtml(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trim()}…` : t;
}

/**
 * @returns {object} route: { template, suffix, directory, pageType, path, query,
 *   status, product, collection, page, blog, article, search, giftCard, policy,
 *   needsCustomer, title, description, handle, currentPage, redirect }
 */
export function resolveRoute(store, pathname, query = new URLSearchParams(), { loggedIn = false } = {}) {
  const path = decodeURI(pathname.replace(/\/+$/, '') || '/');
  const view = query.get('view') || null;
  const base = { path: pathname, query, status: 200, suffix: view, directory: null, currentPage: Math.max(1, parseInt(query.get('page') || '1', 10) || 1) };
  const seg = path.split('/').filter(Boolean);
  const notFound = () => ({ ...base, template: '404', pageType: '404', status: 404, title: '404 Not Found', suffix: null });

  if (path === '/') return { ...base, template: 'index', pageType: 'index', title: store.shop.name, description: store.shop.description };

  if (seg[0] === 'products' && seg[1]) {
    const product = store.productByHandle(seg[1], query.get('variant'));
    if (!product) return notFound();
    return { ...base, template: 'product', pageType: 'product', product, handle: product.handle, suffix: view || product.template_suffix, title: product.title, description: truncate(product.description) };
  }

  if (seg[0] === 'collections') {
    if (!seg[1]) return { ...base, template: 'list-collections', pageType: 'list-collections', title: 'Collections' };
    if (seg[2] === 'products' && seg[3]) {
      const product = store.productByHandle(seg[3], query.get('variant'));
      const collection = store.collectionView(seg[1], { query: new URLSearchParams() });
      if (!product) return notFound();
      return { ...base, template: 'product', pageType: 'product', product, collection, handle: product.handle, suffix: view || product.template_suffix, title: product.title, description: truncate(product.description) };
    }
    const collection = store.collectionView(seg[1], { query, path: `/collections/${seg[1]}` });
    if (!collection) return notFound();
    return { ...base, template: 'collection', pageType: 'collection', collection, handle: collection.handle, suffix: view || collection.template_suffix, title: collection.title, description: truncate(collection.description) };
  }

  if (seg[0] === 'cart' && !seg[1]) return { ...base, template: 'cart', pageType: 'cart', title: 'Your Shopping Cart' };

  if (seg[0] === 'search' && !seg[1]) {
    const q = query.get('q') || '';
    const types = (query.get('type') || 'product,page,article').split(',').map((t) => t.trim()).filter(Boolean);
    const search = store.search(q, { types, query });
    const title = search.performed ? `Search: ${search.results_count} results found for "${q}"` : 'Search';
    return { ...base, template: 'search', pageType: 'search', search, title };
  }

  if (seg[0] === 'pages' && seg[1]) {
    const page = store.pageByHandle(seg[1]);
    if (!page) return notFound();
    return { ...base, template: 'page', pageType: 'page', page, handle: page.handle, suffix: view || page.template_suffix, title: page.title, description: truncate(page.content) };
  }

  if (seg[0] === 'blogs' && seg[1]) {
    const blog = store.blogByHandle(seg[1]);
    if (!blog) return notFound();
    if (seg[2] === 'tagged' && seg[3]) {
      const tag = seg[3];
      const filtered = { ...blog, articles: blog.articles.filter((a) => a.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())) };
      return { ...base, template: 'blog', pageType: 'blog', blog: filtered, currentTags: [tag], handle: blog.handle, suffix: view || blog.template_suffix, title: `${blog.title} — Tagged "${tag}"` };
    }
    if (seg[2]) {
      const article = blog.articles.find((a) => a.handle === seg[2]);
      if (!article) return notFound();
      return { ...base, template: 'article', pageType: 'article', blog, article, handle: article.handle, suffix: view || article.template_suffix, title: article.title, description: truncate(article.excerpt || article.content) };
    }
    return { ...base, template: 'blog', pageType: 'blog', blog, handle: blog.handle, suffix: view || blog.template_suffix, title: blog.title };
  }

  if (seg[0] === 'policies' && seg[1]) {
    const policy = store.policies.find((p) => p.handle === seg[1]);
    if (!policy) return notFound();
    return { ...base, template: 'policy', pageType: 'policy', policy, title: policy.title };
  }

  if (seg[0] === 'account') {
    const c = (name, extra = {}) => ({ ...base, template: name, directory: 'customers', pageType: `customers/${name}`, suffix: null, ...extra });
    if (!seg[1]) return loggedIn ? c('account', { needsCustomer: true, title: 'Account' }) : { ...base, redirect: '/account/login' };
    switch (seg[1]) {
      case 'login': return c('login', { title: 'Account' });
      case 'register': return c('register', { title: 'Create Account' });
      case 'addresses': return loggedIn ? c('addresses', { needsCustomer: true, title: 'Your addresses' }) : { ...base, redirect: '/account/login' };
      case 'orders': return loggedIn ? c('order', { needsCustomer: true, orderId: seg[2], title: 'Order' }) : { ...base, redirect: '/account/login' };
      case 'activate': return c('activate_account', { title: 'Activate Account' });
      case 'reset': return c('reset_password', { title: 'Reset Account' });
      case 'recover': return c('login', { title: 'Account' });
      case 'logout': return { ...base, redirect: '/' };
      default: return notFound();
    }
  }

  if (seg[0] === 'password' && !seg[1]) return { ...base, template: 'password', pageType: 'password', title: store.shop.name };

  if (seg[0] === 'gift_cards' && seg[1]) return { ...base, template: 'gift_card', pageType: 'gift_card', giftCard: store.giftCardDrop(), title: 'Your gift card' };

  return notFound();
}

/** The pages check.mjs renders (every fixture mode: full, empty, real). */
export function routeCatalog(store) {
  const out = [
    ['home', '/'],
    ['list-collections', '/collections'],
    ['collection-all', '/collections/all'],
    ['search-empty', '/search'],
    ['search-hit', '/search?q=bed'],
    ['search-miss', '/search?q=zzzz'],
    ['cart', '/cart'],
    ['404', '/this-page-does-not-exist'],
    ['password', '/password'],
    ['gift-card', '/gift_cards/demo'],
    ['login', '/account/login'],
    ['register', '/account/register'],
    ['account', '/account'],
    ['addresses', '/account/addresses'],
    ['order', '/account/orders/5500000001'],
    ['activate', '/account/activate'],
    ['reset', '/account/reset'],
  ];
  for (const p of store.pages) out.push([`page-${p.handle}`, `/pages/${p.handle}`]);
  for (const b of store.blogs) {
    out.push([`blog-${b.handle}`, `/blogs/${b.handle}`]);
    for (const a of b.articles) out.push([`article-${a.handle.slice(0, 24)}`, `/blogs/${b.handle}/${a.handle}`]);
  }
  if (store.real) {
    for (const h of store.collectionHandles()) if (h !== 'all') out.push([`collection-${h}`, `/collections/${h}`]);
    const sizeVal = (() => { const f = store.collectionView('all').filters.find((x) => x.param_name === 'filter.v.option.size'); return f && f.values[0] ? f.values[0].value : 'Medium'; })();
    out.push(['collection-filtered', `/collections/all?filter.v.option.size=${encodeURIComponent(sizeVal)}&sort_by=price-ascending`]);
    out.push(['collection-type', `/collections/all?filter.p.product_type=${encodeURIComponent(store.products()[0].type)}`]);
    out.push(['collection-page2', '/collections/all?page=2']);
    out.push(['collection-page3', '/collections/all?page=3']);
    out.push(['search-page2', '/search?q=dog&page=2']);
    for (const p of store.products()) out.push([`product-${p.handle.slice(0, 28)}`, p.url]);
    const multi = store.products().find((p) => p.variants.length > 2);
    if (multi) out.push(['product-variant-selected', `${multi.url}?variant=${multi.variants[1].id}`]);
  } else if (!store.empty) {
    for (const h of store.collectionHandles()) if (!['all', 'frontpage'].includes(h)) out.push([`collection-${h}`, `/collections/${h}`]);
    out.push(['collection-filtered', '/collections/orthopaedic-dog-beds?filter.v.option.size=Medium&sort_by=price-ascending']);
    out.push(['collection-page2', '/collections/all?page=2']);
    for (const p of store.products()) out.push([`product-${p.handle.slice(0, 28)}`, p.url]);
    const multi = store.products().find((p) => p.variants.length > 2);
    if (multi) out.push(['product-variant-selected', `${multi.url}?variant=${multi.variants[1].id}`]);
  } else {
    out.push(['collection-frontpage', '/collections/frontpage']);
  }
  return out;
}
