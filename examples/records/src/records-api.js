export const recordsApi = {
  async list({ signal }) {
    const response = await fetch('/api/records.json', { signal });
    if (!response.ok) { throw new Error('Could not load records.'); }
    return response.json();
  }
};
