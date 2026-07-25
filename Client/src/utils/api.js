const API = import.meta.env.VITE_API_BASE || 'https://dsa-duel.onrender.com'

export const clearAuthSession = () => {
  localStorage.removeItem('duel_access_token')
  localStorage.removeItem('duel_refresh_token')
  localStorage.removeItem('duel_user')
  localStorage.removeItem('duel_userId')
  localStorage.removeItem('duel_name')
  localStorage.removeItem('duel_token')
}

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('duel_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const getStoredUserId = () => {
  const user = getStoredUser()
  return user?.id || localStorage.getItem('duel_userId') || ''
}

// Helper function to get auth headers
export const getAuthHeaders = () => {
  const token = localStorage.getItem('duel_access_token')
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  }
}

// Refresh access token
const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('duel_refresh_token')
  if (!refreshToken) return false

  try {
    const response = await fetch(`${API}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    })

    if (response.ok) {
      const data = await response.json()
      localStorage.setItem('duel_access_token', data.accessToken)
      localStorage.setItem('duel_refresh_token', data.refreshToken)
      return true
    }
  } catch (error) {
    console.error('Token refresh failed:', error)
  }
  
  return false
}

// Authenticated fetch wrapper
export const authFetch = async (url, options = {}) => {
  let response = await fetch(`${API}${url}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers
    }
  })

  if (response.status === 401) {
    // Try to refresh token
    const refreshed = await refreshAccessToken()
    
    if (refreshed) {
      // Retry with new token
      response = await fetch(`${API}${url}`, {
        ...options,
        headers: {
          ...getAuthHeaders(),
          ...options.headers
        }
      })
    } else {
      // Refresh failed, clear tokens and reload
      clearAuthSession()
      window.location.reload()
      return
    }
  }

  return response
}

export const logout = async () => {
  try {
    await authFetch('/auth/logout', { method: 'POST' })
  } catch (error) {
    console.error('Logout request failed:', error)
  } finally {
    clearAuthSession()
  }
}

export { API }
