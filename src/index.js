import { createClient } from "@supabase/supabase-js";

const ACCESS_COOKIE = "mbb_access";
const REFRESH_COOKIE = "mbb_refresh";
const SESSION_DAYS = 7;
const BUCKET = "portfolio";
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const VALID_TABS = new Set(["estaticos", "carrosseis", "stories"]);

function dbClient(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error("Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SECRET_KEY.");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function json(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });

  for (const [key, value] of Object.entries(extraHeaders)) {
    if (key.toLowerCase() === "set-cookie" && Array.isArray(value)) {
      for (const cookieValue of value) headers.append("Set-Cookie", cookieValue);
    } else {
      headers.set(key, value);
    }
  }

  return new Response(JSON.stringify(data), { status, headers });
}

function bad(message, status = 400, extraHeaders = {}) {
  return json({ error: message }, status, extraHeaders);
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function cookie(name, value, maxAge = SESSION_DAYS * 24 * 60 * 60) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function clearAuthCookies() {
  return [
    cookie(ACCESS_COOKIE, "", 0),
    cookie(REFRESH_COOKIE, "", 0),
  ];
}

function authHeaders(accessToken, refreshed = null) {
  const headers = {};
  if (refreshed?.access_token && refreshed?.refresh_token) {
    headers["Set-Cookie"] = [
      cookie(ACCESS_COOKIE, refreshed.access_token),
      cookie(REFRESH_COOKIE, refreshed.refresh_token),
    ];
  }
  return headers;
}

async function authRequest(env, path, options = {}) {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function signInWithPassword(env, email, password) {
  const { response, data } = await authRequest(env, "/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok || !data.access_token || !data.refresh_token) {
    return null;
  }

  return data;
}

async function getTrustedUser(env, accessToken) {
  if (!accessToken) return null;

  const { response, data } = await authRequest(env, "/user", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok || !data?.id) return null;
  return data;
}

async function refreshSession(env, refreshToken) {
  if (!refreshToken) return null;

  const { response, data } = await authRequest(env, "/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok || !data.access_token || !data.refresh_token) {
    return null;
  }

  return data;
}

async function requireAdmin(request, env) {
  let accessToken = getCookie(request, ACCESS_COOKIE);
  const refreshToken = getCookie(request, REFRESH_COOKIE);
  let refreshed = null;

  let user = await getTrustedUser(env, accessToken);

  if (!user && refreshToken) {
    refreshed = await refreshSession(env, refreshToken);
    if (refreshed) {
      accessToken = refreshed.access_token;
      user = await getTrustedUser(env, accessToken);
    }
  }

  if (!user) {
    return { admin: null, refreshed: null };
  }

  const db = dbClient(env);
  const { data: admin, error } = await db
    .from("admins")
    .select("id, username, email, auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !admin) {
    return { admin: null, refreshed: null };
  }

  return { admin, refreshed };
}

async function getPortfolio(db) {
  const [{ data: groups, error: groupsError }, { data: items, error: itemsError }] = await Promise.all([
    db.from("portfolio_groups")
      .select("id, tab, client, meta, handle, position")
      .order("position", { ascending: true }),
    db.from("portfolio_items")
      .select("id, group_id, position, image, caption, count, link, images")
      .order("position", { ascending: true }),
  ]);

  if (groupsError) throw groupsError;
  if (itemsError) throw itemsError;

  const result = { estaticos: [], carrosseis: [], stories: [] };

  for (const group of groups || []) {
    if (!result[group.tab]) continue;

    const groupItems = (items || [])
      .filter((item) => item.group_id === group.id)
      .sort((a, b) => a.position - b.position)
      .map((item) => {
        if (group.tab === "carrosseis") {
          return {
            id: item.id,
            images: Array.isArray(item.images) ? item.images : [],
            caption: item.caption || "",
          };
        }

        if (group.tab === "stories") {
          return {
            id: item.id,
            image: item.image,
            caption: item.caption || "",
            count: item.count || 0,
            link: item.link,
          };
        }

        return {
          id: item.id,
          image: item.image,
          caption: item.caption || "",
        };
      });

    result[group.tab].push({
      id: group.id,
      client: group.client || "",
      meta: group.meta || "",
      ...(group.tab === "carrosseis" || group.tab === "stories"
        ? { handle: group.handle || "" }
        : {}),
      items: groupItems,
    });
  }

  return result;
}

async function getLinks(db) {
  const { data, error } = await db
    .from("site_settings")
    .select("links")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return data?.links || {};
}

async function putLinks(db, links) {
  const { data, error } = await db
    .from("site_settings")
    .upsert({ id: 1, links }, { onConflict: "id" })
    .select("links")
    .single();

  if (error) throw error;
  return data.links;
}

async function getGroupAtIndex(db, tab, index) {
  const { data, error } = await db
    .from("portfolio_groups")
    .select("id, tab, client, meta, handle, position")
    .eq("tab", tab)
    .order("position", { ascending: true });

  if (error) throw error;
  return data?.[index] || null;
}

async function getItemAtIndex(db, groupId, index) {
  const { data, error } = await db
    .from("portfolio_items")
    .select("id, group_id, position, image, caption, count, link, images")
    .eq("group_id", groupId)
    .order("position", { ascending: true });

  if (error) throw error;
  return data?.[index] || null;
}

async function nextGroupPosition(db, tab) {
  const { data, error } = await db
    .from("portfolio_groups")
    .select("position")
    .eq("tab", tab)
    .order("position", { ascending: false })
    .limit(1);

  if (error) throw error;
  return (data?.[0]?.position ?? -1) + 1;
}

async function nextItemPosition(db, groupId) {
  const { data, error } = await db
    .from("portfolio_items")
    .select("position")
    .eq("group_id", groupId)
    .order("position", { ascending: false })
    .limit(1);

  if (error) throw error;
  return (data?.[0]?.position ?? -1) + 1;
}

function normalizeTab(tab) {
  return VALID_TABS.has(tab) ? tab : null;
}

function extensionFromFilename(filename) {
  const raw = (filename || "").split(".").pop()?.toLowerCase() || "";
  return ALLOWED_EXTENSIONS.has(raw) ? raw : null;
}

async function uploadImage(request, env) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File) || !file.name) {
    return bad("nenhum arquivo enviado");
  }

  if (file.size > MAX_FILE_SIZE) {
    return bad("arquivo muito grande (máximo 8 MB)");
  }

  const extension = extensionFromFilename(file.name);
  if (!extension) {
    return bad("formato não permitido (use jpg, jpeg, png, webp ou gif)");
  }

  const contentType = file.type || `image/${extension === "jpg" ? "jpeg" : extension}`;
  if (!contentType.startsWith("image/")) {
    return bad("o arquivo enviado não parece ser uma imagem");
  }

  const path = `portfolio/${crypto.randomUUID()}.${extension}`;
  const db = dbClient(env);

  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) throw error;

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return json({ path: data.publicUrl }, 201);
}

async function handleLogin(request, env) {
  const body = await request.json().catch(() => null);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");

  if (!username || !password) {
    return bad("usuário ou senha inválidos", 401);
  }

  const db = dbClient(env);
  const { data: admin, error } = await db
    .from("admins")
    .select("username, email")
    .eq("username", username)
    .maybeSingle();

  if (error || !admin?.email) {
    return bad("usuário ou senha inválidos", 401);
  }

  const session = await signInWithPassword(env, admin.email, password);
  if (!session) {
    return bad("usuário ou senha inválidos", 401);
  }

  return json(
    { username: admin.username },
    200,
    {
      "Set-Cookie": [
        cookie(ACCESS_COOKIE, session.access_token),
        cookie(REFRESH_COOKIE, session.refresh_token),
      ],
    },
  );
}

async function handleAdminApi(request, env, path) {
  const { admin, refreshed } = await requireAdmin(request, env);

  if (!admin) {
    return json({ error: "não autenticado" }, 401, {
      "Set-Cookie": clearAuthCookies(),
    });
  }

  const db = dbClient(env);
  const method = request.method;
  const refreshedHeaders = authHeaders(null, refreshed);

  if (path === "/api/admin/links" && method === "GET") {
    return json(await getLinks(db), 200, refreshedHeaders);
  }

  if (path === "/api/admin/links" && method === "PUT") {
    const data = await request.json().catch(() => null);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return bad("payload inválido, esperado um objeto", 400, refreshedHeaders);
    }
    return json(await putLinks(db, data), 200, refreshedHeaders);
  }

  if (path === "/api/admin/portfolio" && method === "GET") {
    return json(await getPortfolio(db), 200, refreshedHeaders);
  }

  if (path === "/api/admin/upload" && method === "POST") {
    const response = await uploadImage(request, env);
    for (const [key, value] of Object.entries(refreshedHeaders)) {
      if (key.toLowerCase() === "set-cookie" && Array.isArray(value)) {
        for (const cookieValue of value) response.headers.append("Set-Cookie", cookieValue);
      } else {
        response.headers.set(key, value);
      }
    }
    return response;
  }

  const groupCollection = path.match(/^\/api\/admin\/portfolio\/([^/]+)\/groups$/);
  if (groupCollection && method === "POST") {
    const tab = normalizeTab(groupCollection[1]);
    if (!tab) return bad("aba inválida", 400, refreshedHeaders);

    const body = await request.json().catch(() => ({}));
    const position = await nextGroupPosition(db, tab);

    const row = {
      tab,
      client: body.client || "Nome do Cliente",
      meta: body.meta || "",
      handle: tab === "carrosseis" || tab === "stories" ? (body.handle || "") : null,
      position,
    };

    const { data, error } = await db.from("portfolio_groups").insert(row).select().single();
    if (error) throw error;

    return json({ index: position, group: data }, 201, refreshedHeaders);
  }

  const groupDetailed = path.match(/^\/api\/admin\/portfolio\/([^/]+)\/groups\/(\d+)$/);
  if (groupDetailed) {
    const tab = normalizeTab(groupDetailed[1]);
    const index = Number(groupDetailed[2]);
    if (!tab) return bad("aba inválida", 400, refreshedHeaders);

    const group = await getGroupAtIndex(db, tab, index);
    if (!group) return bad("grupo não encontrado", 404, refreshedHeaders);

    if (method === "PUT") {
      const body = await request.json().catch(() => ({}));
      const patch = {};
      for (const field of ["client", "meta", "handle"]) {
        if (field in body) patch[field] = body[field];
      }

      const { data, error } = await db
        .from("portfolio_groups")
        .update(patch)
        .eq("id", group.id)
        .select()
        .single();

      if (error) throw error;
      return json(data, 200, refreshedHeaders);
    }

    if (method === "DELETE") {
      const { error } = await db.from("portfolio_groups").delete().eq("id", group.id);
      if (error) throw error;
      return json(group, 200, refreshedHeaders);
    }
  }

  const itemCollection = path.match(/^\/api\/admin\/portfolio\/([^/]+)\/groups\/(\d+)\/items$/);
  if (itemCollection && method === "POST") {
    const tab = normalizeTab(itemCollection[1]);
    const groupIndex = Number(itemCollection[2]);
    if (!tab) return bad("aba inválida", 400, refreshedHeaders);

    const group = await getGroupAtIndex(db, tab, groupIndex);
    if (!group) return bad("grupo não encontrado", 404, refreshedHeaders);

    const body = await request.json().catch(() => ({}));
    const position = await nextItemPosition(db, group.id);

    const row = {
      group_id: group.id,
      position,
      image: tab === "carrosseis" ? null : (body.image || null),
      caption: body.caption || "",
      count: tab === "stories" ? Number(body.count) || 0 : 0,
      link: tab === "stories" ? (body.link || null) : null,
      images: tab === "carrosseis" && Array.isArray(body.images) ? body.images : [],
    };

    const { data, error } = await db.from("portfolio_items").insert(row).select().single();
    if (error) throw error;

    return json({ index: position, item: data }, 201, refreshedHeaders);
  }

  const itemDetailed = path.match(/^\/api\/admin\/portfolio\/([^/]+)\/groups\/(\d+)\/items\/(\d+)$/);
  if (itemDetailed) {
    const tab = normalizeTab(itemDetailed[1]);
    const groupIndex = Number(itemDetailed[2]);
    const itemIndex = Number(itemDetailed[3]);
    if (!tab) return bad("aba inválida", 400, refreshedHeaders);

    const group = await getGroupAtIndex(db, tab, groupIndex);
    if (!group) return bad("grupo não encontrado", 404, refreshedHeaders);

    const item = await getItemAtIndex(db, group.id, itemIndex);
    if (!item) return bad("item não encontrado", 404, refreshedHeaders);

    if (method === "PUT") {
      const body = await request.json().catch(() => ({}));
      const patch = {};

      if (tab === "carrosseis") {
        patch.images = Array.isArray(body.images) ? body.images : (Array.isArray(item.images) ? item.images : []);
        patch.caption = body.caption ?? item.caption ?? "";
      } else {
        patch.image = body.image ?? item.image ?? null;
        patch.caption = body.caption ?? item.caption ?? "";
        if (tab === "stories") {
          patch.count = Number(body.count) || 0;
          patch.link = body.link || null;
        }
      }

      const { data, error } = await db
        .from("portfolio_items")
        .update(patch)
        .eq("id", item.id)
        .select()
        .single();

      if (error) throw error;
      return json(data, 200, refreshedHeaders);
    }

    if (method === "DELETE") {
      const { error } = await db.from("portfolio_items").delete().eq("id", item.id);
      if (error) throw error;
      return json(item, 200, refreshedHeaders);
    }
  }

  return bad("rota não encontrada", 404, refreshedHeaders);
}

async function handleApi(request, env, url) {
  const path = url.pathname;

  if (path === "/api/health" && request.method === "GET") {
    const db = dbClient(env);
    const { error } = await db.from("site_settings").select("id").eq("id", 1).maybeSingle();
    return error ? json({ status: "error" }, 503) : json({ status: "ok" });
  }

  if (path === "/api/login" && request.method === "POST") {
    return handleLogin(request, env);
  }

  if (path === "/api/logout" && request.method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": clearAuthCookies() });
  }

  if (path === "/api/me" && request.method === "GET") {
    const { admin, refreshed } = await requireAdmin(request, env);

    if (!admin) {
      return json(
        { authenticated: false },
        200,
        { "Set-Cookie": clearAuthCookies() },
      );
    }

    return json(
      { authenticated: true, username: admin.username },
      200,
      authHeaders(null, refreshed),
    );
  }

  if (path === "/api/portfolio" && request.method === "GET") {
    return json(await getPortfolio(dbClient(env)));
  }

  if (path === "/api/links" && request.method === "GET") {
    return json(await getLinks(dbClient(env)));
  }

  if (path.startsWith("/api/admin/")) {
    return handleAdminApi(request, env, path);
  }

  return bad("rota não encontrada", 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, url);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ error: "erro interno do servidor" }, 500);
    }
  },
};
