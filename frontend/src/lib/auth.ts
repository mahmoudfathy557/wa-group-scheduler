export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string, userId: string): void {
  localStorage.setItem('token', token);
  localStorage.setItem('userId', userId);
}

export function clearToken(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
