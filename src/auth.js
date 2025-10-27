// src/auth.js
// Tiny wrapper around Auth0 SPA JS loaded from CDN (no bundler config needed)

let auth0Client = null;
let loadingPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/**
 * Initialize Auth0 client when needed (lazy).
 * @param {{ domain:string, clientId:string, audience:string }} cfg
 */
export async function getAuth0(cfg) {
  if (auth0Client) return auth0Client;
  if (!loadingPromise) {
    loadingPromise = (async () => {
      // Load the SPA SDK from CDN
      if (!window.createAuth0Client) {
        await loadScript("https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js@2.1.3/dist/auth0-spa-js.production.js");
      }
      auth0Client = await window.createAuth0Client({
        domain: cfg.domain,
        clientId: cfg.clientId,
        authorizationParams: { audience: cfg.audience },
        cacheLocation: "memory", // or "localstorage" if you prefer persistence
        useRefreshTokens: true,
      });
      return auth0Client;
    })();
  }
  return loadingPromise;
}

export async function ensureLoggedIn(cfg) {
  const client = await getAuth0(cfg);
  const isAuth = await client.isAuthenticated();
  if (isAuth) return true;

  try {
    // Try silent login first (if the SaaS site has a session with Auth0)
    await client.getTokenSilently();
    return true;
  } catch {
    // Fall back to popup (preferred for widgets)
    await client.loginWithPopup();
    return true;
  }
}

export async function getAccessToken(cfg) {
  const client = await getAuth0(cfg);
  return client.getTokenSilently().catch(async () => {
    await client.loginWithPopup();
    return client.getTokenSilently();
  });
}

export async function logout(cfg) {
  const client = await getAuth0(cfg);
  client.logout({ logoutParams: { returnTo: window.location.origin } });
}
