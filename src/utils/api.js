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

export async function searchOpenAI(keyword, apiKey) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-search-preview",
      web_search_options: {},
      messages: [
        {
          role: "system",
          content: `Eres un experto en clipping. Responde EXCLUSIVAMENTE con un JSON válido. No escribas nada más.
          Formato: {"total":número,"mentions":[{"title":"...","source":"...","url":"https://...","date":"DD/MM/YYYY","excerpt":"..."}],"sources":[{"name":"...","count":número}]}. 
          Busca hasta 20 menciones. Excerpts breves de 1 frase.`
        },
        {
          role: "user",
          content: `Busca menciones recientes de "${keyword}" en prensa digital de España.`
        }
      ],
      max_tokens: 4096
    })
  });
  
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Sin respuesta");
  
  let clean = content.replace(/```json|```/g, "").trim();
  const s = clean.indexOf("{");
  const e = clean.lastIndexOf("}");
  
  if (s === -1 || e === -1) throw new Error("La respuesta no contiene un JSON válido");
  
  const jsonStr = clean.slice(s, e + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    console.warn("JSON mal formado, intentando recuperar...", err);
    // Basic recovery for truncated JSON (closing brackets)
    if (!jsonStr.endsWith("}")) {
       try { return JSON.parse(jsonStr + '}]}'); } catch(e2) {}
    }
    throw new Error("Error en el formato de datos de OpenAI. Inténtalo de nuevo.");
  }
}
