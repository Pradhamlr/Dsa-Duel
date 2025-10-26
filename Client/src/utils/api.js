const API = import.meta.env.VITE_API_BASE || 'https://dsa-duel.onrender.com'

// Helper function to get auth headers
export const getAuthHeaders = () => {
  const token = localStorage.getItem('duel_token')
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  }
}

// Authenticated fetch wrapper
export const authFetch = async (url, options = {}) => {
  const response = await fetch(`${API}${url}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers
    }
  })

  if (response.status === 401) {
    // Token expired or invalid
    localStorage.removeItem('duel_token')
    localStorage.removeItem('duel_user')
    window.location.reload()
    return
  }

  return response
}

export { API }