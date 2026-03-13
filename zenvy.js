/* ============================================================
   ZENVY — zenvy.js  (with user profile, per-user cart/wishlist)
   ============================================================ */

/* ---------- helpers ---------- */
function getLoggedInUser() {
  return localStorage.getItem('loggedIn') === 'true'
    ? JSON.parse(localStorage.getItem('zenvy-user') || 'null')
    : null;
}

function userKey(suffix) {
  const u = getLoggedInUser();
  return u ? `sk-${u.email}-${suffix}` : null;
}

/* ---------- state ---------- */
let allProducts = [];
let cart     = [];
let wishlist = new Set();
let currentSlide = 0, slideTimer;
let activeCategory = 'all';

function loadUserData() {
  const cartKey = userKey('cart');
  const wishKey = userKey('wish');
  cart     = cartKey ? JSON.parse(localStorage.getItem(cartKey) || '[]') : [];
  wishlist = wishKey ? new Set(JSON.parse(localStorage.getItem(wishKey) || '[]')) : new Set();
}

const catCfg = {
  'electronics':      { icon:'💻', label:'Electronics',     bg:'#eff6ff', color:'#2563eb' },
  'jewelery':         { icon:'💎', label:'Jewelery',        bg:'#faf5ff', color:'#9333ea' },
  "men's clothing":   { icon:'👔', label:"Men's Fashion",   bg:'#eff6ff', color:'#1d4ed8' },
  "women's clothing": { icon:'👗', label:"Women's Fashion", bg:'#fdf2f8', color:'#db2777' },
};

/* ---------- products ---------- */
function loadProducts() {
  fetch('https://fakestoreapi.com/products')
    .then(res => res.json())
    .then(data => {
      allProducts = data;
      renderCategories();
      renderProducts(allProducts);
    })
    .catch(() => alert('Failed to load products. Please refresh.'));
}

function renderCategories() {
  const cats = [...new Set(allProducts.map(p => p.category))];
  document.getElementById('cat-grid').innerHTML = cats.map(cat => {
    const cfg   = catCfg[cat] || {};
    const icon  = cfg.icon  || '🛍️';
    const label = cfg.label || cat;
    const bg    = cfg.bg    || '#f0f2f5';
    const color = cfg.color || '#64748b';
    const safeCat = cat.replace(/'/g, "\\'");
    return `
      <button class="cat-card" onclick="filterByCategory('${safeCat}')">
        <div class="cat-ico" style="background:${bg};color:${color}">${icon}</div>
        <span class="cat-label">${label}</span>
      </button>`;
  }).join('');
}

function renderProducts(products) {
  const grid  = document.getElementById('prod-grid');
  const noRes = document.getElementById('no-results');
  const info  = document.getElementById('result-info');

  [...grid.children].forEach(c => { if (c.id !== 'no-results') c.remove(); });

  if (!products.length) {
    noRes.style.display = 'block';
    info.textContent = '';
    return;
  }

  noRes.style.display = 'none';
  info.textContent = products.length === 1 ? '1 product' : products.length + ' products';

  const frag = document.createDocumentFragment();
  products.forEach(p => {
    const disc   = 10 + (p.id * 7) % 30;
    const orig   = (p.price * (1 + disc / 100)).toFixed(2);
    const label  = catCfg[p.category]?.label || p.category;
    const isSale = disc > 22;
    const inCart = cart.some(c => c.id === p.id);
    const inWish = wishlist.has(p.id);

    let rc = 'r-low';
    if (p.rating.rate >= 4) rc = 'r-high';
    else if (p.rating.rate >= 3) rc = 'r-mid';

    const div = document.createElement('div');
    div.className = 'prod-card';
    div.innerHTML = `
      ${isSale ? '<div class="sale-tag">SALE</div>' : ''}
      <div class="card-img">
        <img src="${p.image}" alt="${p.title}" loading="lazy"/>
        <button class="wish-btn${inWish ? ' on' : ''}" data-id="${p.id}" title="Wishlist">♥</button>
      </div>
      <div class="card-body">
        <div class="card-cat-row">
          <span class="card-cat">${label}</span>
          <span class="card-rating ${rc}"><span>★</span>${p.rating.rate}</span>
        </div>
        <h3 class="card-title">${p.title}</h3>
        <div class="card-prices">
          <span class="card-price">$${p.price.toFixed(2)}</span>
          <span class="card-orig">$${orig}</span>
          <span class="card-disc">${disc}% off</span>
        </div>
        <div class="card-reviews">${p.rating.count.toLocaleString()} reviews</div>
      </div>
      <div class="card-foot">
        <button id="atc-${p.id}" class="atc-btn${inCart ? ' added' : ''}" data-id="${p.id}">
          ${inCart ? 'Added to Cart' : 'Add to Cart'}
        </button>
      </div>`;

    div.querySelector('.wish-btn').addEventListener('click', e => handleWishClick(p.id, e.currentTarget));
    div.querySelector('.atc-btn').addEventListener('click', () => handleCartClick(p.id));
    frag.appendChild(div);
  });
  grid.appendChild(frag);
}

/* ---------- auth-gate helpers ---------- */
function requireLogin(action) {
  showAuthPrompt(action);
}

function handleCartClick(id) {
  if (!getLoggedInUser()) { requireLogin('cart'); return; }
  addToCart(id);
}

function handleWishClick(id, btn) {
  if (!getLoggedInUser()) { requireLogin('wish'); return; }
  toggleWishlist(id, btn);
}

/* ---------- auth prompt modal ---------- */
function showAuthPrompt(type) {
  const msg = type === 'cart'
    ? 'You need to be logged in to add items to your cart.'
    : 'You need to be logged in to save items to your wishlist.';

  document.getElementById('auth-prompt-msg').textContent = msg;
  document.getElementById('auth-prompt-overlay').classList.add('open');
}

function closeAuthPrompt() {
  document.getElementById('auth-prompt-overlay').classList.remove('open');
}

/* ---------- cart ---------- */
function addToCart(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  const existing = cart.find(c => c.id === id);
  existing ? existing.qty++ : cart.push({ ...p, qty: 1 });
  saveCart();
  updateBadge();
  refreshCardBtns(id, true);
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  saveCart();
  updateBadge();
  renderCartBody();
  refreshCardBtns(id, false);
}

function changeQty(id, d) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + d);
  saveCart();
  updateBadge();
  renderCartBody();
}

function saveCart() {
  const k = userKey('cart');
  if (k) localStorage.setItem(k, JSON.stringify(cart));
}

function updateBadge() {
  const total = cart.reduce((s, c) => s + c.qty, 0);
  const badge = document.getElementById('cart-badge');
  badge.textContent = total > 99 ? '99+' : total;
  badge.classList.toggle('show', total > 0);
  const hc = document.getElementById('cart-head-count');
  if (hc) hc.textContent = `${total} item${total !== 1 ? 's' : ''}`;
}

function refreshCardBtns(id, inCart) {
  const btn = document.getElementById(`atc-${id}`);
  if (!btn) return;
  btn.className = `atc-btn${inCart ? ' added' : ''}`;
  btn.textContent = inCart ? 'Added to Cart' : 'Add to Cart';
}

function renderCartBody() {
  const body = document.getElementById('cart-body');
  const foot = document.getElementById('cart-foot');

  if (!cart.length) {
    body.innerHTML = `
      <div class="cart-empty">
        <img src="add-to-kart.svg" alt="empty cart"/>
        <h3>Your cart is empty</h3>
        <p>Add some products to get started!</p>
        <button class="btn-continue" onclick="closeCart()">Continue Shopping</button>
      </div>`;
    foot.style.display = 'none';
    return;
  }

  body.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.title}"/>
      <div class="ci-info">
        <div class="ci-title">${item.title}</div>
        <div class="ci-price">$${(item.price * item.qty).toFixed(2)}</div>
        <div class="qty-row">
          <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
        </div>
      </div>
      <button class="ci-del" onclick="removeFromCart(${item.id})">
        <img src="delete.svg" alt="delete" style="width:24px;height:24px;"/>
      </button>
    </div>`).join('');

  const sub = cart.reduce((s, c) => s + c.price * c.qty, 0);
  document.getElementById('cart-sub').textContent = `$${sub.toFixed(2)}`;
  document.getElementById('cart-tot').textContent = `$${sub.toFixed(2)}`;
  foot.style.display = 'block';
}

function openCart() {
  renderCartBody();
  document.getElementById('cart-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cart-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('cart-backdrop').addEventListener('click', closeCart);

/* ---------- wishlist ---------- */
function toggleWishlist(id, btn) {
  const isWished = wishlist.has(id);
  isWished ? wishlist.delete(id) : wishlist.add(id);
  btn.classList.toggle('on', !isWished);
  const k = userKey('wish');
  if (k) localStorage.setItem(k, JSON.stringify([...wishlist]));
  updateWishBadge();
}

function openWishlist() {
  renderWishBody();
  document.getElementById('wish-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeWishlist() {
  document.getElementById('wish-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('wish-backdrop').addEventListener('click', closeWishlist);

function updateWishBadge() {
  const total = wishlist.size;
  const badge = document.getElementById('wish-badge');
  if (badge) {
    badge.textContent = total > 99 ? '99+' : total;
    badge.classList.toggle('show', total > 0);
  }
  const hc = document.getElementById('wish-head-count');
  if (hc) hc.textContent = total + ' item' + (total !== 1 ? 's' : '');
}

function renderWishBody() {
  const body = document.getElementById('wish-body');
  if (!wishlist.size) {
    body.innerHTML = `
      <div class="cart-empty">
        <h3>Your wishlist is empty</h3>
        <p>Click ♥ on any product to save it here!</p>
        <button class="btn-continue" onclick="closeWishlist()">Browse Products</button>
      </div>`;
    return;
  }
  let html = '';
  wishlist.forEach(id => {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;
    html += `
      <div class="cart-item">
        <img src="${p.image}" alt="${p.title}"/>
        <div class="ci-info">
          <div class="ci-title">${p.title}</div>
          <div class="ci-price">$${p.price.toFixed(2)}</div>
          <button class="atc-btn" style="margin-top:8px" onclick="moveToCart(${p.id})">Add to Cart</button>
        </div>
        <button class="ci-del" onclick="removeFromWishlist(${p.id})">
          <img src="delete.svg" alt="remove" style="width:20px;height:20px;"/>
        </button>
      </div>`;
  });
  body.innerHTML = html;
}

function moveToCart(id) { addToCart(id); removeFromWishlist(id); }

function removeFromWishlist(id) {
  wishlist.delete(id);
  const k = userKey('wish');
  if (k) localStorage.setItem(k, JSON.stringify([...wishlist]));
  updateWishBadge();
  renderWishBody();
  const btn = document.querySelector(`.wish-btn[data-id="${id}"]`);
  if (btn) btn.classList.remove('on');
}

/* ---------- user profile panel ---------- */
function openProfile() {
  const user = getLoggedInUser();
  if (!user) { window.location.href = 'login.html'; return; }

  // populate info
  document.getElementById('prof-name').textContent  = user.name  || '—';
  document.getElementById('prof-email').textContent = user.email || '—';
  document.getElementById('prof-initials').textContent =
    (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);

  // cart summary
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  document.getElementById('prof-cart-count').textContent = cartCount + ' item' + (cartCount !== 1 ? 's' : '');
  document.getElementById('prof-cart-total').textContent = '$' + cartTotal.toFixed(2);

  // wish summary
  document.getElementById('prof-wish-count').textContent = wishlist.size + ' item' + (wishlist.size !== 1 ? 's' : '');

  const wl = document.getElementById('prof-wish-list');
  if (!wishlist.size) {
    wl.innerHTML = '<p style="color:var(--text-3);font-size:13px;text-align:center;padding:12px 0">No wishlisted items yet.</p>';
  } else {
    let html = '';
    wishlist.forEach(id => {
      const p = allProducts.find(x => x.id === id);
      if (!p) return;
      html += `
        <div class="prof-mini-item">
          <img src="${p.image}" alt="${p.title}"/>
          <div class="prof-mi-info">
            <div class="prof-mi-title">${p.title}</div>
            <div class="prof-mi-price">$${p.price.toFixed(2)}</div>
          </div>
          <button class="prof-mi-rm" onclick="removeFromWishlist(${p.id});openProfile()">✕</button>
        </div>`;
    });
    wl.innerHTML = html;
  }

  const cl = document.getElementById('prof-cart-list');
  if (!cart.length) {
    cl.innerHTML = '<p style="color:var(--text-3);font-size:13px;text-align:center;padding:12px 0">Your cart is empty.</p>';
  } else {
    cl.innerHTML = cart.map(item => `
      <div class="prof-mini-item">
        <img src="${item.image}" alt="${item.title}"/>
        <div class="prof-mi-info">
          <div class="prof-mi-title">${item.title}</div>
          <div class="prof-mi-price">$${(item.price * item.qty).toFixed(2)} × ${item.qty}</div>
        </div>
        <button class="prof-mi-rm" onclick="removeFromCart(${item.id});openProfile()">✕</button>
      </div>`).join('');
  }

  document.getElementById('profile-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProfile() {
  document.getElementById('profile-overlay').classList.remove('open');
  document.body.style.overflow = '';
}


function filterByCategory(cat) {
  activeCategory = cat;
  document.getElementById('search-input').value = '';

  const isAll    = cat === 'all';
  const filtered = isAll ? allProducts : allProducts.filter(p => p.category === cat);
  const label    = isAll ? 'Trending Products' : (catCfg[cat]?.label || cat);

  document.getElementById('prod-heading').textContent = label;
  document.getElementById('prod-sub').textContent = isAll ? 'Best picks fetched live from our store' : `${filtered.length} products`;
  document.getElementById('clear-btn').style.display = isAll ? 'none' : 'inline';

  const strip = document.getElementById('filter-strip');
  strip.className = isAll ? 'filter-strip' : 'filter-strip on';
  strip.innerHTML = isAll ? '' : `
    <span style="font-size:.75rem;color:var(--text-3);font-weight:600">Filter:</span>
    <span class="f-chip">${label}
      <button onclick="filterByCategory('all')">✕</button>
    </span>`;

  renderProducts(filtered);
  document.getElementById('trending').scrollIntoView({ behavior:'smooth', block:'start' });
}

function handleSearch() {
  const input       = document.getElementById('search-input');
  const suggestions = document.getElementById('search-suggestions');
  const q = input.value.toLowerCase().trim();
  if (!q) { suggestions.style.display = 'none'; return; }

  const results = allProducts.filter(p => p.title.toLowerCase().includes(q));
  suggestions.innerHTML = '';
  results.slice(0,5).forEach(p => {
    const div = document.createElement('div');
    div.className = 'search-item';
    div.textContent = p.title;
    div.onclick = () => { window.location.href = `product.html?id=${p.id}`; };
    suggestions.appendChild(div);
  });
  suggestions.style.display = 'block';
}

document.addEventListener('click', e => {
  const suggestions = document.getElementById('search-suggestions');
  const input = document.getElementById('search-input');
  if (!input.contains(e.target)) suggestions.style.display = 'none';
});


function goSlide(n) {
  const slides = document.querySelectorAll('.c-slide');
  const dots   = document.querySelectorAll('.dot');
  slides[currentSlide].classList.remove('active');
  dots[currentSlide].classList.remove('active');
  currentSlide = n;
  slides[currentSlide].classList.add('active');
  dots[currentSlide].classList.add('active');
}
function nextSlide() { goSlide(currentSlide === 2 ? 0 : currentSlide + 1); }
function prevSlide() { goSlide(currentSlide === 0 ? 2 : currentSlide - 1); }
function startCarousel() { slideTimer = setInterval(nextSlide, 3000); }
function stopCarousel()  { clearInterval(slideTimer); }
function scrollToProducts() { document.getElementById('trending').scrollIntoView({ behavior:'smooth' }); }

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('loggedIn');
  window.location.href = 'login.html';
});


document.getElementById('profile-backdrop').addEventListener('click', closeProfile);

loadUserData();
loadProducts();
updateBadge();
updateWishBadge();
startCarousel();