const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

function buildUrl(url: string) {
  return url.startsWith('/') ? `${API_URL}${url}` : `${API_URL}/${url}`;
}

export default {
  async get(url: string, headers: any = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const response = await fetch(buildUrl(url), {
      headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) throw new Error(await response.text());
    return { data: await response.json() };
  },
  async post(url: string, body: any, headers: any = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const response = await fetch(buildUrl(url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await response.text());
    return { data: await response.json() };
  },
  async put(url: string, body: any, headers: any = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const response = await fetch(buildUrl(url), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await response.text());
    return { data: await response.json() };
  },
  async patch(url: string, body: any, headers: any = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const response = await fetch(buildUrl(url), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await response.text());
    return { data: await response.json() };
  },
  async delete(url: string, headers: any = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const response = await fetch(buildUrl(url), {
      method: 'DELETE',
      headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) throw new Error(await response.text());
    return { data: await response.json() };
  },
};
