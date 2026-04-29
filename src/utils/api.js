export function sbClient(url, key) {
  const h = {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  };
  
  return {
    get: async (t, q = "") => {
      const r = await fetch(`${url}/rest/v1/${t}?${q}`, { headers: h });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    post: async (t, b) => {
      const r = await fetch(`${url}/rest/v1/${t}`, {
        method: "POST",
        headers: { ...h, "Prefer": "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(b)
      });
      if (!r.ok) throw new Error(await r.text());
      return r.status === 204 ? [] : r.json();
    },
    patch: async (t, id, b) => {
      const r = await fetch(`${url}/rest/v1/${t}?id=eq.${id}`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify(b)
      });
      if (!r.ok) throw new Error(await r.text());
    },
    del: async (t, id) => {
      const r = await fetch(`${url}/rest/v1/${t}?id=eq.${id}`, {
        method: "DELETE",
        headers: h
      });
      if (!r.ok) throw new Error(await r.text());
    }
  };
}

export async function searchOpenAI(keyword) {
  // Llamada al proxy serverless para evitar CORS
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword })
  });

  let data;
  try { data = await res.json(); } catch { throw new Error("El servidor no devolvió JSON válido"); }
  if (!res.ok) throw new Error(data.error || `Error ${res.status} en la búsqueda`);
  return data;
}
