import axios from "axios";

const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const API_ROOT = `${backendUrl}/api`;

const client = axios.create({
  baseURL: API_ROOT,
  timeout: 45000,
});

export const screeningApi = {
  health: async () => (await client.get("/health")).data,
  createWorker: async (payload) => (await client.post("/workers", payload)).data,
  listWorkers: async () => (await client.get("/workers")).data,
  startTwilioCall: async (payload) =>
    (await client.post("/calls/twilio/start", payload)).data,
  startSession: async (payload, locale = "en") =>
    (await client.post(`/sessions/start?locale=${locale}`, payload)).data,
  sendTurn: async (sessionId, payload, locale = "en") =>
    (await client.post(`/sessions/${sessionId}/turn?locale=${locale}`, payload)).data,
  captureSnapshot: async (sessionId, payload) =>
    (await client.post(`/sessions/${sessionId}/snapshot`, payload)).data,
  submitPriorWork: async (sessionId, payload) =>
    (await client.post(`/sessions/${sessionId}/prior-work-media`, payload)).data,
  setSelfRatings: async (sessionId, payload) =>
    (await client.post(`/sessions/${sessionId}/self-ratings`, payload)).data,
  submitPortfolioEnrichment: async (sessionId, payload) =>
    (await client.post(`/sessions/${sessionId}/portfolio-enrichment`, payload)).data,
  sendIntegrityEvent: async (sessionId, payload) =>
    (await client.post(`/sessions/${sessionId}/integrity/event`, payload)).data,
  completeSession: async (sessionId, locale = "en") =>
    (await client.post(`/sessions/${sessionId}/complete?locale=${locale}`)).data,
  listLiveSessions: async () => (await client.get("/sessions/live")).data,
  listReports: async () => (await client.get("/sessions/reports")).data,
  getSession: async (sessionId) => (await client.get(`/session/${sessionId}`)).data,
  sttTranscribe: async (formData) =>
    (await client.post("/speech/stt", formData, { headers: { "Content-Type": "multipart/form-data" } })).data,
  ttsSynthesize: async (text, language = "hi-IN") =>
    (await client.post("/speech/tts", { text, language }, { responseType: "blob" })).data,
  onboardWorkerByVoice: async (payload) =>
    (await client.post("/workers/onboard", payload)).data,

  // Karma + Passport
  getWorkerKarma: async (workerId) =>
    (await client.get(`/workers/${workerId}/karma`)).data,
  getPassport: async (workerId) =>
    (await client.get(`/passport/${workerId}`)).data,

  // Human Review Queue
  getReviewQueue: async () =>
    (await client.get("/review/queue")).data,
  submitReviewDecision: async (sessionId, payload) =>
    (await client.post(`/review/${sessionId}/decision`, payload)).data,
};
