export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export const scannerApi = {
    async analyzeCode(code: string) {
        const token = localStorage.getItem('soteria_token');
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}/analyze`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ code }),
        });

        if (!response.ok) {
            throw new Error('Analysis failed');
        }

        return response.json();
    }
}