export const environment = {
    production: false,
    ApiRoot: "http://localhost:9090/api/curation",
    authURL: "http://localhost:9090/api/auth",
  curatorGraphBaseUrl: "https://newcurator.reactome.org/curatorgraph",
    llmURL: "http://127.0.0.1:5000",
    // curator-tool-llm REST service (paper annotation and chat): uvicorn curator_llm.main:app --port 8000
    llmApiURL: "http://localhost:8000/api/llm",
    // Natural-language graph query sidecar (webbenchmcp/nlquery, ./run.sh on :8095). It validates
    // tokens against CURATOR_WS_URL in webbenchmcp/.env, which must match authURL's host (:9090).
    nlQueryURL: "http://localhost:8095/api/nlquery",
    llmOn: false
  };
