// API client for frontend-backend communication

interface AuthRequest {
  email: string;
  password: string;
}

interface RedeemRequest {
  code: string;
  bookId: string;
}

interface SaveWordRequest {
  dictId: string;
  bookId: string;
}

interface ReviewWordRequest {
  ease: number;
}

class ApiError extends Error {
  status: number;
  isUnauthorized: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.isUnauthorized = status === 401;
    this.name = 'ApiError';
  }
}

// Helper function to handle API responses
async function handleResponse(response: Response) {
  if (response.ok) {
    try {
      return await response.json();
    } catch {
      // Handle responses that might not be JSON
      return { success: true };
    }
  }
  
  let errorMessage: string;
  try {
    const errorData = await response.json();
    errorMessage = errorData.message || `Request failed with status ${response.status}`;
  } catch {
    // Handle non-JSON error responses
    errorMessage = `Request failed with status ${response.status}`;
  }
  
  throw new ApiError(errorMessage, response.status);
}

export const api = {
  // Authentication
  async login(data: AuthRequest) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async signup(data: AuthRequest) {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async logout() {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
    });
    return handleResponse(response);
  },

  // Books
  async getBooks() {
    const response = await fetch('/api/books');
    return handleResponse(response);
  },

  async redeemBook(data: RedeemRequest) {
    const response = await fetch('/api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  // Chapters
  async getChapters(bookId: string) {
    const response = await fetch(`/api/chapters/${bookId}`);
    return handleResponse(response);
  },

  // Words
  async saveWord(data: SaveWordRequest) {
    const response = await fetch('/api/words/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async getSavedWords() {
    const response = await fetch('/api/words/saved');
    return handleResponse(response);
  },

  async getReviewWords() {
    const response = await fetch('/api/words/review');
    return handleResponse(response);
  },

  async updateWordReview(wordId: number, data: ReviewWordRequest) {
    const response = await fetch(`/api/words/review/${wordId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
};

// Export the ApiError class so components can check for it
export { ApiError };